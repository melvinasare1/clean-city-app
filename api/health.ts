import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * GET /api/health
 * Health check endpoint for Vercel backend
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
    service: 'vercel-backend',
    timestamp: new Date().toISOString(),
  });
}

