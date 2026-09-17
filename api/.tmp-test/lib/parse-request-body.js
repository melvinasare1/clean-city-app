"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseRequestBody = parseRequestBody;
/** Parse JSON body when Vercel delivers a string or unparsed body. */
function parseRequestBody(req) {
    const raw = req.body;
    if (raw === undefined || raw === null) {
        return {};
    }
    if (typeof raw === 'object' && !Array.isArray(raw)) {
        return raw;
    }
    if (typeof raw === 'string' && raw.trim()) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                return parsed;
            }
        }
        catch {
            return {};
        }
    }
    return {};
}
