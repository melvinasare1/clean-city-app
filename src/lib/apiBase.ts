/**
 * API Base URL helper
 * Reads EXPO_PUBLIC_API_URL from environment and ensures it's properly formatted
 */

/**
 * Get the API base URL from environment variables
 * Trims trailing slashes and throws if missing
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;

  if (!url) {
    throw new Error(
      'EXPO_PUBLIC_API_URL is not configured. Please set it in your environment variables or app.json.'
    );
  }

  // Remove trailing slashes
  return url.replace(/\/+$/, '');
}

/**
 * Get the API base URL, returning empty string if not configured (for optional usage)
 */
export function getApiBaseUrlOrEmpty(): string {
  try {
    return getApiBaseUrl();
  } catch {
    return '';
  }
}

