/**
 * Business WhatsApp for customer support (digits only, country code, no + prefix).
 * Used with https://wa.me/[BUSINESS_WHATSAPP_NUMBER]
 */
export const BUSINESS_WHATSAPP_NUMBER = "233241735474";

export function buildWhatsAppSupportUrl(phoneDigits: string, message: string): string {
  const text = encodeURIComponent(message);
  return `https://wa.me/${phoneDigits}?text=${text}`;
}
