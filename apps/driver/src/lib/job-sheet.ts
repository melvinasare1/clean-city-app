import { TIME_WINDOWS } from '@/lib/time-windows';

const WINDOW_PILL_RANGES: Record<string, string> = {
  MORNING: '8:00 – 12:00',
  AFTERNOON: '12:00 – 4:00',
  EVENING: '4:00 – 8:00',
};

export function isTimestampSet(value: unknown): boolean {
  if (value == null || value === '') return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  return true;
}

export function formatWindowPill(windowId?: string | null, windowLabel?: string | null): string {
  const id = windowId?.trim().toUpperCase() ?? '';
  const match = TIME_WINDOWS.find((window) => window.id === id);
  if (match) {
    const range = WINDOW_PILL_RANGES[match.id] ?? match.timeRange;
    return `${match.title} • ${range}`;
  }
  const label = windowLabel?.trim();
  return label || 'Collection window';
}

export function paymentMethodLabel(method?: string | null): string {
  const value = (method ?? 'momo').trim().toLowerCase();
  if (value === 'momo' || value === 'mobile_money' || value === 'mobile money') {
    return 'Mobile Money';
  }
  if (!value) return 'Mobile Money';
  return method!.trim();
}

export function formatAddressLines(args: {
  addressLine1?: string | null;
  area?: string | null;
  location?: string | null;
}): { line1: string; line2?: string } {
  const line1 = args.addressLine1?.trim() || args.location?.trim() || 'Address not provided';
  const line2 = args.area?.trim();
  if (line2 && line2 !== line1) return { line1, line2 };
  return { line1 };
}
