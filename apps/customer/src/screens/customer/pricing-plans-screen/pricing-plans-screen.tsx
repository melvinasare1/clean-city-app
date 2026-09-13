import React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '@/components';
import { usePricing } from '@/hooks/usePricing';
import { getEnabledBinCatalog, getUnitPrice } from '@/lib/pricing';
import { COLORS } from '@/lib/constants';
import type { CustomerStackParamList } from '@/navigation/types';
import { styles } from './pricing-plans-screen.styles';

type Props = NativeStackScreenProps<CustomerStackParamList, 'PricingPlans'>;

const formatPrice = (value: number) => `¢${value.toFixed(2)}`;

export const PricingPlansScreen: React.FC<Props> = () => {
  const { pricing, loading } = usePricing();
  const bins = getEnabledBinCatalog(pricing);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <AppText style={styles.intro}>
        Current pickup prices for enabled bin types. Choose bins when you book
        a pickup — one-off and recurring options are in that flow.
      </AppText>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={styles.loader} />
      ) : bins.length === 0 ? (
        <AppText style={styles.empty}>
          No bin types are available right now. Please try again later.
        </AppText>
      ) : (
        bins.map((bin) => (
          <View key={bin.key} style={styles.card}>
            <View style={styles.cardCopy}>
              <AppText style={styles.binName}>{bin.label}</AppText>
              <AppText style={styles.binDescription}>{bin.description}</AppText>
            </View>
            <AppText style={styles.price}>
              {formatPrice(getUnitPrice(pricing, bin.key))}
            </AppText>
          </View>
        ))
      )}
    </ScrollView>
  );
};
