import type { Booking, BookingBinItem } from '@platform/shared-types';
import type { Subscription } from '@/types/subscription';
import { TIME_WINDOWS } from '@/lib/time-windows';
import { toMillis } from '@/lib/referral-utils';
import {
  getNextPickupIsoForBooking,
  getNextPickupIsoForSubscription,
} from '../booking-detail/booking-detail-screen.utils';
import { getBinSummary } from '../my-bookings/my-bookings-screen.utils';
import { BIN_CATALOG } from '@/lib/pricing';
import type { BinPriceKey } from '@/types/pricing';

export const PROFILE_STEPS_TOTAL = 4;

export function getGreetingName(name?: string | null): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

export function getInitials(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatWhenLabel(isoDate: string): string {
  const target = startOfDay(new Date(`${isoDate}T12:00:00`));
  const today = startOfDay(new Date());
  const tomorrow = startOfDay(
    new Date(today.getTime() + 24 * 60 * 60 * 1000)
  );

  if (toIsoDate(target) === toIsoDate(today)) return 'Today';
  if (toIsoDate(target) === toIsoDate(tomorrow)) return 'Tomorrow';

  return target.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatWindowRange(
  windowId?: string | null,
  windowLabel?: string | null
): string | null {
  if (windowId) {
    const match = TIME_WINDOWS.find((w) => w.id === windowId);
    if (match) return match.timeRange;
  }
  if (windowLabel?.trim()) return windowLabel.trim();
  return null;
}

export type NextCollectionInfo = {
  isoDate: string;
  headline: string;
  wasteLabel: string;
};

export function getNextCollection(
  bookings: Booking[],
  subscriptions: Subscription[]
): NextCollectionInfo | null {
  const todayStr = toIsoDate(startOfDay(new Date()));
  const candidates: {
    isoDate: string;
    windowId?: string | null;
    windowLabel?: string | null;
    wasteLabel: string;
  }[] = [];

  for (const booking of bookings) {
    const iso = getNextPickupIsoForBooking(booking);
    if (!iso || iso < todayStr) continue;
    candidates.push({
      isoDate: iso,
      windowId: booking.windowId,
      windowLabel: booking.windowLabel,
      wasteLabel: getBinSummary(booking.items),
    });
  }

  for (const sub of subscriptions) {
    if (sub.status === 'cancelled') continue;
    const iso = getNextPickupIsoForSubscription(sub, bookings);
    if (!iso || iso < todayStr) continue;
    const alreadyCovered = candidates.some((c) => c.isoDate === iso);
    if (alreadyCovered) continue;
    candidates.push({
      isoDate: iso,
      wasteLabel: 'Recurring collection',
    });
  }

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
  const next = candidates[0];
  const when = formatWhenLabel(next.isoDate);
  const range = formatWindowRange(next.windowId, next.windowLabel);
  const headline = range ? `${when}, ${range}` : when;
  const wasteLabel =
    !next.wasteLabel || next.wasteLabel === 'No bins recorded'
      ? 'Waste collection'
      : next.wasteLabel;

  return { isoDate: next.isoDate, headline, wasteLabel };
}

export function getLastReorderableBooking(
  bookings: Booking[]
): Booking | null {
  const eligible = bookings.filter(
    (b) => b.status !== 'cancelled' && b.items?.length
  );
  if (!eligible.length) return null;

  return [...eligible].sort((a, b) => {
    const aMs = toMillis(a.createdAt) ?? 0;
    const bMs = toMillis(b.createdAt) ?? 0;
    if (bMs !== aMs) return bMs - aMs;
    return (b.date ?? '').localeCompare(a.date ?? '');
  })[0];
}

export function quantitiesFromBookingItems(
  items: BookingBinItem[]
): Record<BinPriceKey, number> {
  const quantities: Record<BinPriceKey, number> = {
    smallBag: 0,
    standardBin: 0,
    wheelieBin: 0,
  };

  for (const item of items) {
    const match = BIN_CATALOG.find(
      (bin) =>
        bin.id === item.id ||
        bin.label === item.type ||
        bin.key === item.id
    );
    if (!match) continue;
    quantities[match.key] += item.quantity;
  }

  return quantities;
}

export function hasPrefillQuantities(
  quantities: Record<BinPriceKey, number>
): boolean {
  return Object.values(quantities).some((n) => n > 0);
}
