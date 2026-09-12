/**
 * Driver account status helpers (client).
 */

export type DriverAccountStatus = 'pending' | 'approved' | 'suspended';

export function normalizeDriverStatus(
  data: Record<string, unknown> | undefined
): DriverAccountStatus {
  const status = data?.status;
  if (status === 'suspended') return 'suspended';
  if (status === 'approved' || data?.isActive === true) return 'approved';
  if (status === 'pending' || data?.isActive === false) return 'pending';
  return 'pending';
}

export function isDriverApprovedStatus(status: DriverAccountStatus): boolean {
  return status === 'approved';
}
