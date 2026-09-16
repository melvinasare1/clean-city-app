import crypto from "crypto";

const DEFAULT_TOLERANCE_SECONDS = 300;

export function rawBodyForStripeSignature(body: unknown): Buffer {
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (Buffer.isBuffer(body)) return body;
  return Buffer.from(JSON.stringify(body ?? {}), "utf8");
}

export function parseStripeSignatureHeader(
  header: string | undefined
): { timestamp: string; signatures: string[] } | null {
  if (!header) return null;
  const timestamp = header
    .split(",")
    .map((part) => part.trim())
    .find((part) => part.startsWith("t="))
    ?.slice(2);
  const signatures = header
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0) return null;
  return { timestamp, signatures };
}

export function stripeSignatureForPayload(
  secret: string,
  timestamp: string,
  rawBody: Buffer
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody.toString("utf8")}`, "utf8")
    .digest("hex");
}

export function isValidStripeSignature(
  secret: string,
  rawBody: Buffer,
  signatureHeader: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = DEFAULT_TOLERANCE_SECONDS
): boolean {
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed) return false;
  const timestamp = Number(parsed.timestamp);
  if (!Number.isFinite(timestamp)) return false;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const expected = stripeSignatureForPayload(secret, parsed.timestamp, rawBody);
  const expectedBuf = Buffer.from(expected, "utf8");
  return parsed.signatures.some((sig) => {
    const actual = Buffer.from(sig, "utf8");
    return (
      actual.length === expectedBuf.length &&
      crypto.timingSafeEqual(actual, expectedBuf)
    );
  });
}
