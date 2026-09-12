/**
 * Admin helper functions
 * Checks if a user has admin privileges
 */

import type { AppUser, AppUserRole } from '@/contexts/auth-context';

/**
 * Check if a user is an admin
 * Option A: checks if user.role === "admin"
 * 
 * @param user - User object from auth context
 * @returns true if user is admin, false otherwise
 */
export const isAdmin = (user: AppUser | null): boolean => {
  if (!user) {
    return false;
  }
  return user.role === 'admin';
};

/**
 * Require admin access - throws error if user is not admin
 * Use this to block navigation/rendering if not admin
 * 
 * @param user - User object from auth context
 * @throws Error if user is not admin
 */
export const requireAdmin = (user: AppUser | null): void => {
  if (!isAdmin(user)) {
    throw new Error('Admin access required');
  }
};

/**
 * Get admin role constant
 */
export const ADMIN_ROLE: AppUserRole = 'admin';

