import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@platform/shared-firebase';
import { useAuth } from '@/hooks/useAuth';
import { usePricing } from '@/hooks/usePricing';
import { isAdmin } from '@/lib/admin';
import {
  PRICING_CONFIG_COLLECTION,
  PRICING_CONFIG_DOC_ID,
} from '@/lib/pricing';
import type { PricingTier } from '@/types/pricing';
import { AppText } from '@/components';
import { COLORS } from '@/lib/constants';

const TIER_OPTIONS: { tier: PricingTier; label: string; description: string }[] = [
  { tier: 'low', label: 'Low', description: 'Discounted pricing to encourage bookings' },
  { tier: 'standard', label: 'Standard', description: 'Normal, unmodified pricing' },
  { tier: 'surge', label: 'Surge', description: 'Higher pricing during high demand' },
];

const TIER_CONFIRM_LABEL: Record<PricingTier, string> = {
  low: 'Low demand pricing',
  standard: 'Standard pricing',
  surge: 'High demand pricing',
};

export const AdminPricingScreen: React.FC = () => {
  const { user } = useAuth();
  const { pricing, loading } = usePricing();
  const [saving, setSaving] = useState<PricingTier | null>(null);

  useEffect(() => {
    if (!isAdmin(user)) {
      Alert.alert('Access Denied', 'Admin access required');
    }
  }, [user]);

  if (!isAdmin(user)) {
    return (
      <View style={styles.container}>
        <AppText style={styles.errorText}>Admin access required</AppText>
      </View>
    );
  }

  const handleSelectTier = (tier: PricingTier) => {
    if (tier === pricing.activeTier || saving) return;

    Alert.alert(
      'Change pricing tier',
      `Switch live pricing to "${TIER_CONFIRM_LABEL[tier]}"? This immediately affects prices shown to customers.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Switch',
          onPress: async () => {
            setSaving(tier);
            try {
              await setDoc(
                doc(db, PRICING_CONFIG_COLLECTION, PRICING_CONFIG_DOC_ID),
                {
                  activeTier: tier,
                  // Always resend the current multipliers so the write is
                  // self-contained: config/pricing may not have any fields
                  // set yet (no admin has ever written to it), and the
                  // Firestore rule requires lowMultiplier/surgeMultiplier
                  // to be present and valid on every write to this doc.
                  lowMultiplier: pricing.lowMultiplier,
                  surgeMultiplier: pricing.surgeMultiplier,
                  updatedAt: serverTimestamp(),
                  updatedBy: user?.id ?? null,
                },
                { merge: true }
              );
            } catch (error: any) {
              Alert.alert(
                'Failed to change tier',
                error?.message ?? 'Please try again.'
              );
            } finally {
              setSaving(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <AppText style={styles.sectionTitle}>Live pricing tier</AppText>
      <AppText style={styles.helperText}>
        Controls the multiplier applied to every bin price shown to
        customers and used when a booking is created. Changing this never
        affects bookings already created.
      </AppText>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={styles.loader} />
      ) : (
        <>
          <View style={styles.tierRow}>
            {TIER_OPTIONS.map(({ tier, label }) => {
              const active = pricing.activeTier === tier;
              return (
                <TouchableOpacity
                  key={tier}
                  style={[styles.tierButton, active && styles.tierButtonActive]}
                  onPress={() => handleSelectTier(tier)}
                  disabled={saving !== null}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Set pricing tier to ${label}`}
                >
                  {saving === tier ? (
                    <ActivityIndicator color={active ? COLORS.white : COLORS.primary} />
                  ) : (
                    <AppText
                      style={[styles.tierButtonText, active && styles.tierButtonTextActive]}
                    >
                      {label}
                    </AppText>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.referenceCard}>
            <AppText style={styles.referenceTitle}>Current multipliers</AppText>
            <View style={styles.referenceRow}>
              <AppText style={styles.referenceLabel}>Low</AppText>
              <AppText style={styles.referenceValue}>
                ×{pricing.lowMultiplier.toFixed(2)}
              </AppText>
            </View>
            <View style={styles.referenceRow}>
              <AppText style={styles.referenceLabel}>Standard</AppText>
              <AppText style={styles.referenceValue}>×1.00</AppText>
            </View>
            <View style={styles.referenceRow}>
              <AppText style={styles.referenceLabel}>Surge</AppText>
              <AppText style={styles.referenceValue}>
                ×{pricing.surgeMultiplier.toFixed(2)}
              </AppText>
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: COLORS.text,
  },
  helperText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 20,
    lineHeight: 18,
  },
  loader: {
    marginTop: 24,
  },
  tierRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  tierButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  tierButtonActive: {
    backgroundColor: COLORS.primary,
  },
  tierButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  tierButtonTextActive: {
    color: COLORS.white,
  },
  referenceCard: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 8,
  },
  referenceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  referenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  referenceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  referenceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 32,
  },
});
