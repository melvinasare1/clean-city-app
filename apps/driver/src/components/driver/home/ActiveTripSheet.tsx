import React from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@platform/shared-theme';
import type { ActiveTrip } from '@/hooks/useAssignedJobOffer';

type Props = {
  trip: ActiveTrip;
  onStart: () => void;
  onComplete: () => void;
  onCancel: () => void;
  starting?: boolean;
  completing?: boolean;
  cancelling?: boolean;
  bottomInset?: number;
  routeAwayLabel?: string | null;
};

const CANCEL_CONFIRM_COPY =
  'Cancelling will reduce your priority by 10. Frequent cancellations can lead to account suspension.';

function showHelpStub() {
  Alert.alert('Get help', 'Support is coming soon. If you need assistance now, contact Clean City.');
}

function confirmCancelTrip(onCancel: () => void) {
  Alert.alert('Cancel this trip?', CANCEL_CONFIRM_COPY, [
    { text: 'Keep trip', style: 'cancel' },
    { text: 'Cancel trip', style: 'destructive', onPress: onCancel },
  ]);
}

function openTripOverflowMenu(onCancel: () => void) {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Get help', 'Cancel trip', 'Close'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (buttonIndex) => {
        if (buttonIndex === 0) showHelpStub();
        if (buttonIndex === 1) confirmCancelTrip(onCancel);
      }
    );
    return;
  }

  Alert.alert('Trip options', undefined, [
    { text: 'Get help', onPress: showHelpStub },
    { text: 'Cancel trip', style: 'destructive', onPress: () => confirmCancelTrip(onCancel) },
    { text: 'Close', style: 'cancel' },
  ]);
}

export function ActiveTripSheet({
  trip,
  onStart,
  onComplete,
  onCancel,
  starting,
  completing,
  cancelling,
  bottomInset = 0,
  routeAwayLabel,
}: Props) {
  const fare = trip.totalPrice ?? trip.amountPaid;
  const busy = Boolean(starting || completing || cancelling);
  const canStart =
    trip.assignmentStatus === 'accepted' && (trip.jobStatus === 'scheduled' || !trip.jobStatus);
  const canComplete = trip.jobStatus === 'in_progress';

  return (
    <View style={[styles.sheet, { paddingBottom: spacing.xl + bottomInset }]}>
      <View style={styles.grabber} />

      <View style={styles.headerRow}>
        <View style={styles.headerCopy}>
          <Text style={typography.statusTitle}>
            {canComplete ? 'Trip in progress' : 'Job accepted'}
          </Text>
          <Text style={[typography.statusSubtext, styles.timestamp]}>
            {canComplete ? 'Head to the pickup' : 'Start when you head to the pickup'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {fare != null ? (
            <View style={styles.farePill}>
              <Text style={typography.earningsValue}>¢{Number(fare).toFixed(2)}</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => openTripOverflowMenu(onCancel)}
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

      <Pressable
        style={[styles.btnComplete, busy && styles.btnDisabled]}
        onPress={canComplete ? onComplete : onStart}
        disabled={busy || (!canStart && !canComplete)}
        accessibilityRole="button"
        accessibilityLabel={canComplete ? 'Complete job' : 'Start job'}
      >
        <Text style={styles.btnCompleteLabel}>
          {canComplete
            ? completing
              ? 'Completing…'
              : 'Complete job'
            : starting
              ? 'Starting…'
              : 'Start job'}
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
});
