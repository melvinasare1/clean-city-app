export const TIME_WINDOWS = [
  { id: "MORNING", label: "Morning (8am - 12pm)" },
  { id: "AFTERNOON", label: "Afternoon (12pm - 4pm)" },
  { id: "EVENING", label: "Evening (4pm - 8pm)" },
] as const;

export type TimeWindowId = (typeof TIME_WINDOWS)[number]["id"];

export function getTimeWindowLabel(windowId: TimeWindowId): string {
  const match = TIME_WINDOWS.find((window) => window.id === windowId);
  if (!match) {
    throw new Error(`Unknown time window: ${windowId}`);
  }
  return match.label;
}
