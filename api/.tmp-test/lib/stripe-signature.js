"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rawBodyForStripeSignature = rawBodyForStripeSignature;
exports.parseStripeSignatureHeader = parseStripeSignatureHeader;
exports.stripeSignatureForPayload = stripeSignatureForPayload;
exports.isValidStripeSignature = isValidStripeSignature;
const crypto_1 = __importDefault(require("crypto"));
const DEFAULT_TOLERANCE_SECONDS = 300;
function rawBodyForStripeSignature(body) {
    if (typeof body === "string")
        return Buffer.from(body, "utf8");
    if (Buffer.isBuffer(body))
        return body;
    return Buffer.from(JSON.stringify(body ?? {}), "utf8");
}
function parseStripeSignatureHeader(header) {
    if (!header)
        return null;
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
    if (!timestamp || signatures.length === 0)
        return null;
    return { timestamp, signatures };
}
function stripeSignatureForPayload(secret, timestamp, rawBody) {
    return crypto_1.default
        .createHmac("sha256", secret)
        .update(`${timestamp}.${rawBody.toString("utf8")}`, "utf8")
        .digest("hex");
}
function isValidStripeSignature(secret, rawBody, signatureHeader, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = DEFAULT_TOLERANCE_SECONDS) {
    const parsed = parseStripeSignatureHeader(signatureHeader);
    if (!parsed)
        return false;
    const timestamp = Number(parsed.timestamp);
    if (!Number.isFinite(timestamp))
        return false;
    if (Math.abs(nowSeconds - timestamp) > toleranceSeconds)
        return false;
    const expected = stripeSignatureForPayload(secret, parsed.timestamp, rawBody);
    const expectedBuf = Buffer.from(expected, "utf8");
    return parsed.signatures.some((sig) => {
        const actual = Buffer.from(sig, "utf8");
        return (actual.length === expectedBuf.length &&
            crypto_1.default.timingSafeEqual(actual, expectedBuf));
    });
}
