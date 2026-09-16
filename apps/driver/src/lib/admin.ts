/**
 * The driver app has no admin surface. Privilege is never derived from profiles.role.
 */

import type { AppUser } from '@/contexts/auth-context';

export const isAdmin = (_user: AppUser | null): boolean => {
  return false;
};

export const requireAdmin = (user: AppUser | null): void => {
  if (!isAdmin(user)) {
    throw new Error('Admin access required');
  }
};
