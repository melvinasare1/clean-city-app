/**
 * POST /api/geocode
 * Forward-geocodes an address via Google Geocoding, server-side.
 * Body: { address: string }
 * Response: { lat, lng, formattedAddress }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseRequestBody } from "./lib/parse-request-body";
import { geocodeAddressGoogle } from "./lib/geocode-google";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseRequestBody(req);
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!address) {
    return res.status(400).json({ error: "Missing required field: address" });
  }

  try {
    const hit = await geocodeAddressGoogle(address);
    if (!hit) {
      return res.status(404).json({ error: "No geocoding result found" });
    }
    return res.status(200).json({
      lat: hit.lat,
      lng: hit.lng,
      formattedAddress: hit.formattedAddress,
    });
  } catch (error: unknown) {
    console.error("[POST /api/geocode] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
