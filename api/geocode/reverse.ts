/**
 * POST /api/geocode/reverse
 * Reverse-geocodes a coordinate via Google Geocoding, server-side.
 * Body: { lat: number, lng: number }
 * Response: { lat, lng, formattedAddress }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseRequestBody } from "../lib/parse-request-body";
import { parsePickupCoordinates } from "../lib/geocode-address";
import { reverseGeocodeGoogle } from "../lib/geocode-google";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const body = parseRequestBody(req);
  const coords = parsePickupCoordinates({ lat: body.lat, lng: body.lng });
  if (!coords) {
    return res.status(400).json({ error: "Missing or invalid required fields: lat, lng" });
  }

  try {
    const hit = await reverseGeocodeGoogle(coords.lat, coords.lng);
    if (!hit) {
      return res.status(404).json({ error: "No geocoding result found" });
    }
    return res.status(200).json({
      lat: hit.lat,
      lng: hit.lng,
      formattedAddress: hit.formattedAddress,
    });
  } catch (error: unknown) {
    console.error("[POST /api/geocode/reverse] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return res.status(500).json({ error: "Internal server error", details: message });
  }
}
