import { auth } from "@platform/shared-firebase";
import { getApiBaseUrl } from "@/lib/apiBase";

async function getAuthHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in to continue.");
  }
  const token = await currentUser.getIdToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function submitDriverRating(
  bookingId: string,
  stars: number,
  comment?: string
): Promise<void> {
  const base = getApiBaseUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${base}/api/bookings/rate`, {
    method: "POST",
    headers,
    body: JSON.stringify({ bookingId, stars, comment }),
  });

  if (!response.ok) {
    const json = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(json.error || "Could not submit rating");
  }
}
