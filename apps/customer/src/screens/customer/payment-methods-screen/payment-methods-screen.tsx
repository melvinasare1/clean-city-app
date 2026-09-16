import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, ScreenContainer } from '@/components';
import { COLORS } from '@/lib/constants';
import { styles } from './payment-methods-screen.styles';

export const PaymentMethodsScreen: React.FC = () => {
  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="phone-portrait-outline" size={28} color={COLORS.primary} />
        </View>
        <AppText style={styles.heading}>How you can pay</AppText>
        <AppText style={styles.body}>
          One-time pickups can be paid with Mobile Money through Paystack, or by
          card through Stripe. CleanCity does not store your card or Mobile Money
          details. Subscriptions currently use Mobile Money / Paystack only.
        </AppText>
      </View>
    </ScreenContainer>
  );
};
