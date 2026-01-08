import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/health
 * Health check endpoint for the Vercel backend.
 */
export default function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({
    ok: true,
    service: 'clean-city-backend',
    time: new Date().toISOString(),
  });
}

