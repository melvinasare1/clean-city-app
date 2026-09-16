// Kept in sync by hand with DRIVER_COMMISSION_RATE in functions/src/job-offers.ts —
// the driver app can't depend on the Cloud Functions workspace.
export const DRIVER_COMMISSION_RATE = 0.8;

export function driverEarningsFromGross(gross: number): number {
  return gross * DRIVER_COMMISSION_RATE;
}
