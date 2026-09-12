export type EarningsPeriod = 'day' | 'week' | 'month' | 'all';

export const EARNINGS_PERIODS: { id: EarningsPeriod; label: string }[] = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'all', label: 'All time' },
];

const ALL_TIME_START = new Date(2020, 0, 1);

export function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export function startOfWeekMonday(date: Date): Date {
  const next = startOfDay(date);
  const weekday = next.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  next.setDate(next.getDate() + diff);
  return next;
}

export function endOfWeekSunday(date: Date): Date {
  const start = startOfWeekMonday(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return endOfDay(end);
}

export function startOfMonth(date: Date): Date {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function rangeForPeriod(
  period: EarningsPeriod,
  anchor: Date
): { start: Date; end: Date } {
  if (period === 'day') {
    return { start: startOfDay(anchor), end: endOfDay(anchor) };
  }
  if (period === 'week') {
    return { start: startOfWeekMonday(anchor), end: endOfWeekSunday(anchor) };
  }
  if (period === 'month') {
    return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
  }
  return { start: startOfDay(ALL_TIME_START), end: endOfDay(new Date()) };
}

export function shiftAnchor(
  date: Date,
  period: EarningsPeriod,
  direction: -1 | 1
): Date {
  const next = new Date(date);
  if (period === 'day') next.setDate(next.getDate() + direction);
  if (period === 'week') next.setDate(next.getDate() + direction * 7);
  if (period === 'month') next.setMonth(next.getMonth() + direction);
  return next;
}

export function canShiftForward(
  period: EarningsPeriod,
  anchor: Date,
  now: Date = new Date()
): boolean {
  if (period === 'all') return false;
  const { start } = rangeForPeriod(period, shiftAnchor(anchor, period, 1));
  return startOfDay(start).getTime() <= endOfDay(now).getTime();
}

export function formatPeriodLabel(
  period: EarningsPeriod,
  start: Date,
  end: Date
): string {
  if (period === 'all') return 'All time';

  if (period === 'day') {
    return start.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  if (period === 'month') {
    return start.toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
    });
  }

  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const endPart = end.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  if (sameMonth) {
    return `${start.getDate()} – ${endPart}`;
  }
  const startPart = start.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
  return `${startPart} – ${endPart}`;
}

export function nextPayoutDate(from: Date = new Date()): Date {
  const next = startOfDay(from);
  const weekday = next.getDay();
  const daysUntilMonday = weekday === 0 ? 1 : weekday === 1 ? 7 : 8 - weekday;
  next.setDate(next.getDate() + daysUntilMonday);
  return next;
}

export function formatPayoutDate(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const rest = date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  return `${weekday}, ${rest}`;
}
