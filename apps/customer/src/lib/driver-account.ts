/**
 * Driver account status helpers (client).
 */

export type DriverAccountStatus = 'pending' | 'approved' | 'suspended';

const VALID_STATUSES: DriverAccountStatus[] = ['pending', 'approved', 'suspended'];

export function normalizeDriverStatus(
  data: Record<string, unknown> | undefined
): DriverAccountStatus {
  const status = data?.status;
  if (typeof status === 'string' && VALID_STATUSES.includes(status as DriverAccountStatus)) {
    return status as DriverAccountStatus;
  }
  if (data?.isActive === true) return 'approved';
  if (data?.isActive === false) return 'pending';
  return 'pending';
}

export function isDriverApprovedStatus(status: DriverAccountStatus): boolean {
  return status === 'approved';
}
