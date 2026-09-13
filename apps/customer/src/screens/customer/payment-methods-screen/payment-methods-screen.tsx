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
        <AppText style={styles.heading}>Mobile Money</AppText>
        <AppText style={styles.body}>
          You pay via Mobile Money (MoMo) at checkout. CleanCity does not store
          cards or other payment methods on file. When you book a pickup, Paystack
          collects payment through your Mobile Money wallet.
        </AppText>
      </View>
    </ScreenContainer>
  );
};
