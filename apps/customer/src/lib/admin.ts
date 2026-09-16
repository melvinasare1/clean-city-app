/**
 * Staff privilege is determined only from admins/{uid}.
 * profiles.role is never an authority source.
 */

import type { AppUser } from '@/contexts/auth-context';
import { staffAccessFromAdminDoc, type StaffRole } from '@/lib/staff-access';

export { staffAccessFromAdminDoc };
export type { StaffRole };

/** True only for an approved admin on admins/{uid}. */
export const isAdmin = (user: AppUser | null): boolean => {
  return user?.staffRole === 'admin';
};

/** Approved admin or assistant from admins/{uid}. */
export const isStaff = (user: AppUser | null): boolean => {
  return user?.staffRole === 'admin' || user?.staffRole === 'assistant';
};

export const requireAdmin = (user: AppUser | null): void => {
  if (!isAdmin(user)) {
    throw new Error('Admin access required');
  }
};

export const ADMIN_ROLE: StaffRole = 'admin';
