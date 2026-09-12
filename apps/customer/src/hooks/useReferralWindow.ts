import { useEffect, useMemo, useState } from 'react';
import {
  formatReferralTimeRemaining,
  getReferralWindowCloseAt,
  isReferralWindowOpen,
  type ReferralWindowUser,
} from '@/lib/referral-utils';

export function useReferralWindow(user: ReferralWindowUser | null | undefined) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const referralWindowOpen = useMemo(
    () => isReferralWindowOpen(user ?? {}, now),
    [user, now]
  );

  const timeRemainingLabel = useMemo(() => {
    const closeAt = getReferralWindowCloseAt(user?.signupAt);
    if (!closeAt) return '';
    return formatReferralTimeRemaining(closeAt - now);
  }, [user?.signupAt, now]);

  return { referralWindowOpen, timeRemainingLabel, now };
}
