export type ReferralApplyErrorCode =
  | 'invalid_code'
  | 'window_closed'
  | 'self_referral'
  | 'already_used'
  | 'unauthorized'
  | 'profile_not_found'
  | 'server_error'
  | 'network_error';

export interface ReferralDiscount {
  type: 'percent';
  value: number;
  appliesTo: 'first_booking';
}

export interface ApplyReferralCodeResponse {
  success: boolean;
  discount?: ReferralDiscount;
  error?: ReferralApplyErrorCode;
}

export interface ReferralStatsResponse {
  code: string;
  friendsReferred: number;
  freePickupsEarned: number;
  freePickupThreshold: number;
}

export interface UserReferralStats {
  friendsReferred: number;
  freePickupsEarned: number;
  freePickupThreshold: number;
}
