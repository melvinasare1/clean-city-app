import crypto from "crypto";

export function rawBodyForSignature(body: unknown): Buffer {
  if (typeof body === "string") return Buffer.from(body, "utf8");
  if (Buffer.isBuffer(body)) return body;
  return Buffer.from(JSON.stringify(body ?? {}), "utf8");
}

export function isValidPaystackSignature(
  secret: string,
  rawBody: Buffer,
  signature: string | undefined
): boolean {
  if (!signature) return false;
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signature;
}
