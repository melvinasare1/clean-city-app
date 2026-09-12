import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Timestamp } from 'firebase/firestore';
import { colors, radius, spacing, typography } from '@platform/shared-theme';
import type { JobOffer } from '@/hooks/useAssignedJobOffer';

type Props = {
  offer: JobOffer;
  onAccept: () => void;
  accepting?: boolean;
  bottomInset?: number;
};

function formatDate(value?: Timestamp | string) {
  if (!value) return 'Date TBC';
  const d = value instanceof Timestamp ? value.toDate() : new Date(value);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function JobOfferSheet({ offer, onAccept, accepting, bottomInset = 0 }: Props) {
  const fare = offer.totalPrice ?? offer.amountPaid;

  return (
    <View style={[styles.sheet, { paddingBottom: spacing.xl + bottomInset }]}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={typography.statusTitle}>New job assigned</Text>
          <Text style={[typography.statusSubtext, styles.timestamp]}>
            {formatDate(offer.scheduledDate)}
          </Text>
        </View>
        {fare != null && (
          <View style={styles.farePill}>
            <Text style={typography.earningsValue}>£{Number(fare).toFixed(2)}</Text>
          </View>
        )}
      </View>

      <View style={styles.detailCard}>
        <View style={styles.detailRow}>
          <Feather name="user" size={16} color={colors.inkSecondary} />
          <Text style={styles.detailText}>{offer.customerName ?? 'Customer'}</Text>
        </View>
        <View style={styles.detailRow}>
          <Feather name="map-pin" size={16} color={colors.inkSecondary} />
          <Text style={styles.detailText} numberOfLines={2}>
            {offer.address ?? 'Address not provided'}
          </Text>
        </View>
        {offer.subscriptionId && (
          <View style={styles.detailRow}>
            <Feather name="repeat" size={16} color={colors.inkSecondary} />
            <Text style={styles.detailText}>Recurring booking</Text>
          </View>
        )}
      </View>

      <Pressable
        style={[styles.btnAccept, accepting && styles.btnDisabled]}
        onPress={onAccept}
        disabled={accepting}
        accessibilityRole="button"
        accessibilityLabel="Accept job"
      >
        <Text style={styles.btnAcceptLabel}>{accepting ? 'Accepting…' : 'Accept job'}</Text>
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
  btnAccept: {
    borderRadius: radius.card,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.brandGreen,
    minHeight: 54,
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.75,
  },
  btnAcceptLabel: {
    ...typography.button,
    color: '#fff',
  },
});
