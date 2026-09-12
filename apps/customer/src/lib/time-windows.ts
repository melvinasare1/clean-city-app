import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type TimeWindowDefinition = {
  id: 'MORNING' | 'AFTERNOON' | 'EVENING';
  /** Stored on bookings (includes times for clarity). */
  label: string;
  title: string;
  timeRange: string;
  icon: IoniconName;
};

export const TIME_WINDOWS: readonly TimeWindowDefinition[] = [
  {
    id: 'MORNING',
    label: 'Morning (8am - 12pm)',
    title: 'Morning',
    timeRange: '08:00 AM - 12:00 PM',
    icon: 'sunny-outline',
  },
  {
    id: 'AFTERNOON',
    label: 'Afternoon (12pm - 4pm)',
    title: 'Afternoon',
    timeRange: '12:00 PM - 04:00 PM',
    icon: 'sunny',
  },
  {
    id: 'EVENING',
    label: 'Evening (4pm - 8pm)',
    title: 'Evening',
    timeRange: '04:00 PM - 08:00 PM',
    icon: 'moon-outline',
  },
] as const;

export type TimeWindowId = (typeof TIME_WINDOWS)[number]['id'];

export function getTimeWindowLabel(windowId: TimeWindowId): string {
  const match = TIME_WINDOWS.find((window) => window.id === windowId);
  if (!match) {
    throw new Error(`Unknown time window: ${windowId}`);
  }
  return match.label;
}
