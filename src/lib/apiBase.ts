/**
 * API Base URL helper
 *
 * Reads EXPO_PUBLIC_API_URL from environment, trims trailing slashes,
 * and either returns a clean base URL or throws a clear error if missing.
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;

  if (!url) {
    throw new Error(
      "EXPO_PUBLIC_API_URL is not configured. Please set it in your environment variables or app.json."
    );
  }

  // Remove trailing slashes so callers can safely append `/api/...`
  return url.replace(/\/+$/, "");
}

/**
 * Get the API base URL, returning empty string if not configured (for optional usage).
 */
export function getApiBaseUrlOrEmpty(): string {
  try {
    return getApiBaseUrl();
  } catch {
    return "";
  }
}
