import type { VercelRequest } from '@vercel/node';

/** Parse JSON body when Vercel delivers a string or unparsed body. */
export function parseRequestBody(req: VercelRequest): Record<string, unknown> {
  const raw = req.body;
  if (raw === undefined || raw === null) {
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}
