import type { ReferralApplyErrorCode } from '@/types/referral';

export const REFERRAL_WINDOW_HOURS = 48;
export const FREE_PICKUP_THRESHOLD = 3;
export const APP_SHARE_LINK = 'https://cleancitygh.com';

/** e.g. CC-ABC123 or custom codes; letters, numbers, hyphens only */
export const REFERRAL_CODE_MAX_LENGTH = 15;
const REFERRAL_CODE_PATTERN = /^[A-Z0-9-]{6,15}$/;

export function normalizeReferralCodeInput(value: string): string {
  return value.trim().toUpperCase();
}

export function isReferralCodeFormatValid(code: string): boolean {
  return REFERRAL_CODE_PATTERN.test(normalizeReferralCodeInput(code));
}

export function sanitizeReferralCodeInput(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
}

export function getReferralErrorMessage(error: ReferralApplyErrorCode): string {
  switch (error) {
    case 'invalid_code':
      return "That code doesn't exist. Check it and try again.";
    case 'window_closed':
      return 'The referral window has closed. Codes can only be added within 48 hours of signup or before your first booking.';
    case 'self_referral':
      return "You can't use your own referral code.";
    case 'already_used':
      return "You've already applied a referral code.";
    case 'unauthorized':
      return 'Please sign in again and try applying your code.';
    case 'profile_not_found':
      return "We couldn't load your profile. Try again after signing in.";
    case 'network_error':
      return "Couldn't reach the server. Check your connection and try again.";
    case 'server_error':
      return "We couldn't apply your code right now. Please try again in a moment.";
    default:
      return 'Something went wrong. Please try again.';
  }
}

export function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const toMillisFn = (value as { toMillis?: () => number }).toMillis;
    if (typeof toMillisFn === 'function') return toMillisFn.call(value);
  }
  return null;
}

export interface ReferralWindowUser {
  signupAt?: string | Date | null;
  firstBookingAt?: string | Date | null;
  referralCodeApplied?: boolean;
}

export function isReferralWindowOpen(user: ReferralWindowUser, now = Date.now()): boolean {
  const signupMs = toMillis(user.signupAt);
  if (!signupMs) return false;

  const hoursSinceSignup = (now - signupMs) / (1000 * 60 * 60);
  const withinTimeLimit = hoursSinceSignup < REFERRAL_WINDOW_HOURS;
  const noBookingYet = !user.firstBookingAt;
  const notApplied = !user.referralCodeApplied;

  return withinTimeLimit && noBookingYet && notApplied;
}

export function getReferralWindowCloseAt(signupAt: unknown): number | null {
  const signupMs = toMillis(signupAt);
  if (!signupMs) return null;
  return signupMs + REFERRAL_WINDOW_HOURS * 60 * 60 * 1000;
}

export function formatReferralTimeRemaining(msRemaining: number): string {
  if (msRemaining <= 0) return 'Closes soon';

  const hrsRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
  const minsRemaining = Math.floor((msRemaining % (1000 * 60 * 60)) / (1000 * 60));

  if (hrsRemaining <= 0) {
    return `Closes in ${minsRemaining} min${minsRemaining === 1 ? '' : 's'}`;
  }

  return `Closes in ${hrsRemaining} hrs ${minsRemaining} mins`;
}

export function getProfileCompletionSteps(user: {
  email?: string;
  phone?: string;
  location?: string;
}): { label: string; complete: boolean }[] {
  return [
    { label: 'Email address', complete: !!user.email },
    { label: 'Phone number', complete: !!user.phone },
    { label: 'Pickup location', complete: !!user.location },
  ];
}

export function getProfileCompletionCount(user: {
  email?: string;
  phone?: string;
  location?: string;
}): number {
  return getProfileCompletionSteps(user).filter((step) => step.complete).length;
}

export function isProfileComplete(user: {
  phone?: string;
  location?: string;
}): boolean {
  return !!user.phone && !!user.location;
}

export function getReferralStatsDisplay(
  friendsReferred: number,
  freePickupThreshold = FREE_PICKUP_THRESHOLD
): UserReferralStatsDisplay {
  const freePickupsEarned = Math.floor(friendsReferred / freePickupThreshold);
  const remainder = friendsReferred % freePickupThreshold;
  const moreForFreePickup =
    remainder === 0
      ? freePickupThreshold
      : freePickupThreshold - remainder;

  return {
    friendsReferred,
    freePickupsEarned,
    freePickupThreshold,
    moreForFreePickup,
  };
}

export interface UserReferralStatsDisplay {
  friendsReferred: number;
  freePickupsEarned: number;
  freePickupThreshold: number;
  moreForFreePickup: number;
}

export function buildReferralShareMessage(code: string): string {
  return `Hey! I use CleanAccra to get my rubbish collected in Accra. Sign up with my code ${code} and get 10% off your first pickup: ${APP_SHARE_LINK}`;
}

export function buildWhatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
