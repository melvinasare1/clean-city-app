import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@platform/shared-theme';
import type { ActiveTrip } from '@/hooks/useAssignedJobOffer';

type Props = {
  trip: ActiveTrip;
  onComplete: () => void;
  onCancel: () => void;
  completing?: boolean;
  cancelling?: boolean;
  bottomInset?: number;
};

export function ActiveTripSheet({
  trip,
  onComplete,
  onCancel,
  completing,
  cancelling,
  bottomInset = 0,
}: Props) {
  const fare = trip.totalPrice ?? trip.amountPaid;
  const busy = Boolean(completing || cancelling);

  return (
    <View style={[styles.sheet, { paddingBottom: spacing.xl + bottomInset }]}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={typography.statusTitle}>Trip in progress</Text>
          <Text style={[typography.statusSubtext, styles.timestamp]}>
            Head to the pickup
          </Text>
        </View>
        {fare != null ? (
          <View style={styles.farePill}>
            <Text style={typography.earningsValue}>¢{Number(fare).toFixed(2)}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.detailCard}>
        <View style={styles.detailRow}>
          <Feather name="user" size={16} color={colors.inkSecondary} />
          <Text style={styles.detailText}>{trip.customerName ?? 'Customer'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={16} color={colors.inkSecondary} />
          <Text style={styles.detailText} numberOfLines={2}>
            {trip.address ?? 'Address not provided'}
          </Text>
        </View>
        {trip.subscriptionId ? (
          <View style={styles.detailRow}>
            <Feather name="repeat" size={16} color={colors.inkSecondary} />
            <Text style={styles.detailText}>Recurring booking</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        style={[styles.btnComplete, busy && styles.btnDisabled]}
        onPress={onComplete}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Complete job"
      >
        <Text style={styles.btnCompleteLabel}>
          {completing ? 'Completing…' : 'Complete job'}
        </Text>
      </Pressable>

      <Pressable
        onPress={onCancel}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Cancel trip"
        style={styles.cancelLink}
      >
        <Text style={[styles.cancelLabel, busy && styles.cancelDisabled]}>
          {cancelling ? 'Cancelling…' : 'Cancel trip'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surfaceWhite,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
    zIndex: 20,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E3E0D9',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  timestamp: {
    marginTop: 2,
  },
  farePill: {
    backgroundColor: colors.brandGreenSoft,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  detailCard: {
    backgroundColor: '#F7F6F2',
    borderRadius: radius.card,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  detailText: {
    ...typography.body,
    color: colors.inkPrimary,
    flex: 1,
  },
  btnComplete: {
    borderRadius: radius.card,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.brandGreen,
    minHeight: 54,
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnCompleteLabel: {
    ...typography.button,
    color: '#fff',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  cancelLabel: {
    ...typography.body,
    color: colors.signalRed,
    fontWeight: '600',
  },
  cancelDisabled: {
    opacity: 0.55,
  },
});
