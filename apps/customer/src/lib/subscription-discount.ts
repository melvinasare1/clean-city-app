export type SubscriptionDiscountFrequency = "weekly" | "biweekly" | "monthly";

/**
 * Discount rate (0–1) off the undiscounted subscription period total.
 * Weekly 10%, Biweekly 7%, Monthly 5%.
 */
export function getSubscriptionDiscount(
  frequency: SubscriptionDiscountFrequency
): number {
  switch (frequency) {
    case "weekly":
      return 0.1;
    case "biweekly":
      return 0.07;
    case "monthly":
      return 0.05;
    default: {
      const _exhaustive: never = frequency;
      return _exhaustive;
    }
  }
}

export function intervalWeeksToDiscountFrequency(
  intervalWeeks: number
): SubscriptionDiscountFrequency {
  if (intervalWeeks === 1) return "weekly";
  if (intervalWeeks === 2) return "biweekly";
  return "monthly";
}

export function formatSubscriptionDiscountBadge(
  frequency: SubscriptionDiscountFrequency
): string {
  const pct = Math.round(getSubscriptionDiscount(frequency) * 100);
  return `${pct}% off`;
}
