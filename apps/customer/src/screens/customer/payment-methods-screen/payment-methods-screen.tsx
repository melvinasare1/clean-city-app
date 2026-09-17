import React, { useCallback, useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, ScreenContainer } from '@/components';
import { COLORS } from '@/lib/constants';
import { useAuth } from '@/hooks/useAuth';
import { setDocAtPath } from '@/lib/utils';
import { STRIPE_PAYMENTS_ENABLED } from '@/lib/stripe-payments-enabled';
import {
  DEFAULT_STRIPE_CURRENCY,
  STRIPE_CHARGE_CURRENCIES,
  normalizeStripeChargeCurrency,
  type StripeChargeCurrency,
} from '@/lib/stripe-currency';
import { styles } from './payment-methods-screen.styles';

export const PaymentMethodsScreen: React.FC = () => {
  const { user, refreshUserProfile } = useAuth();
  const [currency, setCurrency] = useState<StripeChargeCurrency>(
    normalizeStripeChargeCurrency(user?.preferredStripeCurrency || DEFAULT_STRIPE_CURRENCY)
  );
  const [saving, setSaving] = useState(false);

  const saveCurrency = useCallback(
    async (next: StripeChargeCurrency) => {
      if (!user?.id) return;
      const previous = currency;
      setCurrency(next);
      setSaving(true);
      try {
        await setDocAtPath(
          ['profiles', user.id],
          { preferredStripeCurrency: next },
          { merge: true, addTimestamps: true }
        );
        await refreshUserProfile();
      } catch (err) {
        setCurrency(previous);
        Alert.alert(
          'Could not save',
          err instanceof Error ? err.message : 'Please try again.'
        );
      } finally {
        setSaving(false);
      }
    },
    [currency, refreshUserProfile, user?.id]
  );

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="phone-portrait-outline" size={28} color={COLORS.primary} />
        </View>
        <AppText style={styles.heading}>How you can pay</AppText>
        <AppText style={styles.body}>
          {STRIPE_PAYMENTS_ENABLED
            ? 'One-time pickups of GHS 100 or less must use Mobile Money. Above GHS 100 you can pay with Mobile Money or card. Subscriptions can use Mobile Money or card. Card payments are charged in your selected currency after a live conversion from GHS, plus a 2% card payment surcharge.'
            : 'Pay with Mobile Money (MTN, Telecel or AirtelTigo). Card payments are temporarily unavailable.'}
        </AppText>
      </View>
      {STRIPE_PAYMENTS_ENABLED ? (
        <View style={styles.card}>
          <AppText style={styles.heading}>Card currency</AppText>
          <AppText style={styles.body}>
            This is the currency Stripe Checkout uses. It is not read from your
            card. Your bank may convert if the card is in a different currency.
          </AppText>
          <View style={styles.currencyRow}>
            {STRIPE_CHARGE_CURRENCIES.map((code) => (
              <TouchableOpacity
                key={code}
                style={[
                  styles.currencyChip,
                  currency === code && styles.currencyChipSelected,
                ]}
                onPress={() => saveCurrency(code)}
                disabled={saving}
                accessibilityRole="button"
                accessibilityState={{ selected: currency === code, disabled: saving }}
                accessibilityLabel={code}
              >
                <AppText
                  style={[
                    styles.currencyChipText,
                    currency === code && styles.currencyChipTextSelected,
                  ]}
                >
                  {code}
                </AppText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}
    </ScreenContainer>
  );
};
