import type { VercelRequest, VercelResponse } from '@vercel/node';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const ADMIN_SECRET = process.env.ADMIN_SECRET;

interface PushRequest {
  to?: string;
  tokens?: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
}

/**
 * POST /api/push
 * Send push notifications via Expo Push Service
 * 
 * Supports:
 * - Single token: { to: string, title, body, data? }
 * - Batch tokens: { tokens: string[], title, body, data? }
 * 
 * Optional security: X-ADMIN-SECRET header
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional admin secret check
  if (ADMIN_SECRET) {
    const providedSecret = req.headers['x-admin-secret'] as string | undefined;
    if (providedSecret !== ADMIN_SECRET) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing X-ADMIN-SECRET header',
      });
    }
  }

  try {
    const body = req.body as PushRequest;
    const { to, tokens, title, body: bodyText, data } = body;

    // Validate required fields
    if (!title || !bodyText) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'body'],
      });
    }

    // Determine if single or batch
    if (tokens && Array.isArray(tokens) && tokens.length > 0) {
      // Batch mode
      return await handleBatchPush(tokens, title, bodyText, data, res);
    } else if (to) {
      // Single token mode
      return await handleSinglePush(to, title, bodyText, data, res);
    } else {
      return res.status(400).json({
        error: 'Either "to" (single token) or "tokens" (array) is required',
      });
    }
  } catch (error: any) {
    console.error('Error in push handler:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error?.message || 'Unknown error',
    });
  }
}

/**
 * Handle single push notification
 */
async function handleSinglePush(
  to: string,
  title: string,
  body: string,
  data: Record<string, any> | undefined,
  res: VercelResponse
) {
  // Validate token format
  if (
    !to.startsWith('ExponentPushToken[') &&
    !to.startsWith('ExpoPushToken[')
  ) {
    return res.status(400).json({
      error: 'Invalid Expo push token format',
      hint: 'Token should start with ExponentPushToken[ or ExpoPushToken[',
    });
  }

  const message = {
    to,
    sound: 'default',
    title,
    body,
    data: data || {},
  };

  // Send to Expo Push Service
  const expoResponse = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
    },
    body: JSON.stringify(message),
  });

  const result = await expoResponse.json();

  if (!expoResponse.ok) {
    console.error('Expo Push Service error:', result);
    return res.status(expoResponse.status).json({
      error: 'Failed to send notification',
      details: result,
    });
  }

  // Expo returns an array of receipts
  const receipt = Array.isArray(result.data) ? result.data[0] : result.data;

  if (receipt?.status === 'error') {
    console.error('Expo push error:', receipt);
    return res.status(400).json({
      error: 'Expo push notification error',
      details: receipt,
    });
  }

  // Fetch receipt after a short delay (Expo recommends this)
  let finalReceipt = receipt;
  try {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    if (receipt?.id) {
      const receiptResponse = await fetch(
        `https://exp.host/--/api/v2/push/getReceipts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ ids: [receipt.id] }),
        }
      );
      const receiptData = await receiptResponse.json();
      if (receiptData.data && receiptData.data[receipt.id]) {
        finalReceipt = receiptData.data[receipt.id];
      }
    }
  } catch (err) {
    console.warn('Could not fetch receipt, using ticket:', err);
  }

  return res.status(200).json({
    success: true,
    receipt: finalReceipt,
    ticket: receipt,
    message: 'Notification sent successfully',
  });
}

/**
 * Handle batch push notifications (chunks of max 100)
 */
async function handleBatchPush(
  tokens: string[],
  title: string,
  body: string,
  data: Record<string, any> | undefined,
  res: VercelResponse
) {
  // Validate tokens
  const invalidTokens = tokens.filter(
    (token) =>
      !token.startsWith('ExponentPushToken[') &&
      !token.startsWith('ExpoPushToken[')
  );

  if (invalidTokens.length > 0) {
    return res.status(400).json({
      error: 'Invalid token format(s)',
      invalidCount: invalidTokens.length,
      hint: 'Tokens should start with ExponentPushToken[ or ExpoPushToken[',
    });
  }

  // Chunk tokens (max 100 per Expo request)
  const CHUNK_SIZE = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    chunks.push(tokens.slice(i, i + CHUNK_SIZE));
  }

  const allTickets: any[] = [];
  const allReceipts: any[] = [];
  const errors: any[] = [];

  // Process each chunk
  for (const chunk of chunks) {
    const messages = chunk.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }));

    try {
      const expoResponse = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });

      const result = await expoResponse.json();

      if (!expoResponse.ok) {
        errors.push({
          chunk: chunk.length,
          error: result,
        });
        continue;
      }

      // Collect tickets
      if (Array.isArray(result.data)) {
        allTickets.push(...result.data);
      } else {
        allTickets.push(result.data);
      }
    } catch (error: any) {
      errors.push({
        chunk: chunk.length,
        error: error?.message || 'Unknown error',
      });
    }
  }

  // Fetch receipts after a short delay
  const receiptIds = allTickets
    .filter((t) => t?.id)
    .map((t) => t.id);

  if (receiptIds.length > 0) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const receiptResponse = await fetch(
        `https://exp.host/--/api/v2/push/getReceipts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ ids: receiptIds }),
        }
      );
      const receiptData = await receiptResponse.json();
      if (receiptData.data) {
        Object.values(receiptData.data).forEach((receipt) => {
          allReceipts.push(receipt);
        });
      }
    } catch (err) {
      console.warn('Could not fetch receipts:', err);
    }
  }

  return res.status(200).json({
    success: true,
    count: allTickets.length,
    tickets: allTickets,
    receipts: allReceipts,
    errors: errors.length > 0 ? errors : undefined,
    message: `Sent ${allTickets.length} notification(s)`,
  });
}

