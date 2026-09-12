/**
 * Business WhatsApp for customer support (digits only, country code, no + prefix).
 * Used with https://wa.me/[BUSINESS_WHATSAPP_NUMBER]
 */
export const BUSINESS_WHATSAPP_NUMBER = "233551019719";

export function buildWhatsAppSupportUrl(phoneDigits: string, message: string): string {
  const text = encodeURIComponent(message);
  return `https://wa.me/${phoneDigits}?text=${text}`;
}

export function buildDeleteAccountMessage(userId: string): string {
  return `I want to delete my account. User ID: ${userId}`;
}

export function getDeleteAccountWhatsAppUrl(userId: string): string {
  return buildWhatsAppSupportUrl(
    BUSINESS_WHATSAPP_NUMBER,
    buildDeleteAccountMessage(userId)
  );
}
