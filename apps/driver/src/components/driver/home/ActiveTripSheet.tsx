import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@platform/shared-theme';
import type { ActiveTrip } from '@/hooks/useAssignedJobOffer';
import { isTimestampSet } from '@/lib/job-sheet';
import { openTripOverflowMenu } from '@/lib/trip-overflow';

type Props = {
  trip: ActiveTrip;
  onStart: () => void;
  onNavigate: () => void;
  onArrived: () => void;
  onOpenJobSheet: () => void;
  onComplete: () => void;
  onCancel: () => void;
  starting?: boolean;
  arriving?: boolean;
  completing?: boolean;
  cancelling?: boolean;
  bottomInset?: number;
  routeAwayLabel?: string | null;
};

export function ActiveTripSheet({
  trip,
  onStart,
  onNavigate,
  onArrived,
  onOpenJobSheet,
  onComplete,
  onCancel,
  starting,
  arriving,
  completing,
  cancelling,
  bottomInset = 0,
  routeAwayLabel,
}: Props) {
  const fare = trip.totalPrice ?? trip.amountPaid;
  const busy = Boolean(starting || arriving || completing || cancelling);
  const canStart =
    trip.assignmentStatus === 'accepted' && (trip.jobStatus === 'scheduled' || !trip.jobStatus);
  const inProgress = trip.jobStatus === 'in_progress';
  const arrived = isTimestampSet(trip.arrivedAt);
  const pickupConfirmed = isTimestampSet(trip.pickupConfirmedAt);

  let primaryLabel = 'Navigate';
  let primaryBusyLabel = 'Starting…';
  let onPrimary = onStart;
  let primaryDisabled = busy || !canStart;
  let accessibilityLabel = 'Navigate';

  if (inProgress && !arrived) {
    primaryLabel = 'Arrived';
    primaryBusyLabel = 'Marking arrived…';
    onPrimary = onArrived;
    primaryDisabled = busy;
    accessibilityLabel = 'Arrived';
  } else if (inProgress && arrived && !pickupConfirmed) {
    primaryLabel = 'Job Sheet';
    primaryBusyLabel = 'Job Sheet';
    onPrimary = onOpenJobSheet;
    primaryDisabled = busy;
    accessibilityLabel = 'Job Sheet';
  } else if (inProgress && pickupConfirmed) {
    primaryLabel = 'Complete job';
    primaryBusyLabel = 'Completing…';
    onPrimary = onComplete;
    primaryDisabled = busy;
    accessibilityLabel = 'Complete job';
  }

  const showPrimaryBusy =
    (inProgress && !arrived && arriving) ||
    (inProgress && pickupConfirmed && completing) ||
    (!inProgress && starting);

  return (
    <View style={[styles.sheet, { paddingBottom: spacing.xl + bottomInset }]}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={typography.statusTitle}>
            {inProgress ? 'Trip in progress' : 'Job accepted'}
          </Text>
          <Text style={[typography.statusSubtext, styles.timestamp]}>
            {inProgress ? 'Head to the pickup' : 'Start when you head to the pickup'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {fare != null ? (
            <View style={styles.farePill}>
              <Text style={typography.earningsValue}>¢{Number(fare).toFixed(2)}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() =>
              openTripOverflowMenu({
                phone: trip.phoneNumber,
                onCancel,
              })
            }
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="More trip actions"
            style={[styles.overflowButton, busy && styles.btnDisabled]}
          >
            <Feather name="more-horizontal" size={20} color={colors.inkPrimary} />
          </Pressable>
        </View>
      </View>
      {routeAwayLabel ? (
        <View style={styles.routeAwayPill}>
          <Feather name="navigation" size={18} color={colors.brandGreen} />
          <Text style={styles.routeAwayText}>{routeAwayLabel}</Text>
        </View>
      ) : null}

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

      {inProgress ? (
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.renavigateButton, busy && styles.btnDisabled]}
            onPress={onNavigate}
            disabled={busy}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Navigate to pickup"
          >
            <Feather name="navigation" size={18} color={colors.inkPrimary} />
          </Pressable>
          <Pressable
            style={[styles.btnComplete, styles.btnCompleteFlex, primaryDisabled && styles.btnDisabled]}
            onPress={onPrimary}
            disabled={primaryDisabled}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
          >
            <Text style={styles.btnCompleteLabel}>
              {showPrimaryBusy ? primaryBusyLabel : primaryLabel}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={[styles.btnComplete, primaryDisabled && styles.btnDisabled]}
          onPress={onPrimary}
          disabled={primaryDisabled}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
        >
          <Text style={styles.btnCompleteLabel}>
            {showPrimaryBusy ? primaryBusyLabel : primaryLabel}
          </Text>
        </Pressable>
      )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overflowButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
  routeAwayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brandGreenSoft,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.md,
  },
  routeAwayText: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.brandGreen,
    flex: 1,
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  renavigateButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E3E0D9',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  btnComplete: {
    borderRadius: radius.card,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.brandGreen,
    minHeight: 54,
    justifyContent: 'center',
  },
  btnCompleteFlex: {
    flex: 1,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  btnCompleteLabel: {
    ...typography.button,
    color: '#fff',
  },
});
