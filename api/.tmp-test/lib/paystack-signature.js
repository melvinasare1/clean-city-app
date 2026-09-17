"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rawBodyForSignature = rawBodyForSignature;
exports.isValidPaystackSignature = isValidPaystackSignature;
const crypto_1 = __importDefault(require("crypto"));
function rawBodyForSignature(body) {
    if (typeof body === "string")
        return Buffer.from(body, "utf8");
    if (Buffer.isBuffer(body))
        return body;
    return Buffer.from(JSON.stringify(body ?? {}), "utf8");
}
function isValidPaystackSignature(secret, rawBody, signature) {
    if (!signature)
        return false;
    const hash = crypto_1.default.createHmac("sha512", secret).update(rawBody).digest("hex");
    return hash === signature;
}
