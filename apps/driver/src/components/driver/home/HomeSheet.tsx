import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@platform/shared-theme';

type Props = {
  greeting: string;
  driverName: string;
  isOnline: boolean;
  todaysEarnings: number;
  onToggleOnline: () => void;
  onEarningsPress: () => void;
  toggleLoading?: boolean;
  bottomInset?: number;
};

export function HomeSheet({
  greeting,
  driverName,
  isOnline,
  todaysEarnings,
  onToggleOnline,
  onEarningsPress,
  toggleLoading,
  bottomInset = 0,
}: Props) {
  return (
    <View style={[styles.sheet, { paddingBottom: spacing.xl + bottomInset }]}>
      <View style={styles.grabber} />

      <View style={styles.row}>
        <View style={styles.greeting}>
          <Text style={typography.headline}>
            {greeting}, {driverName}
          </Text>
          <Text style={[typography.body, styles.greetingSubtext]}>
            {isOnline ? "You're online and ready for jobs" : "You're currently offline"}
          </Text>
        </View>

        <Pressable
          style={styles.earningsPill}
          onPress={onEarningsPress}
          accessibilityRole="button"
          accessibilityLabel="Today's earnings"
        >
          <View>
            <Text style={typography.earningsValue}>¢{todaysEarnings.toFixed(2)}</Text>
            <Text style={typography.earningsLabel}>Today's earnings</Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.inkSecondary} />
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusIcon,
            { backgroundColor: isOnline ? colors.brandGreenSoft : colors.surfaceMutedIcon },
          ]}
        >
          <Feather
            name={isOnline ? 'radio' : 'wifi-off'}
            size={18}
            color={isOnline ? colors.brandGreen : colors.inkSecondary}
          />
        </View>
        <View style={styles.statusCopy}>
          <Text style={typography.statusTitle}>
            {isOnline ? 'Looking for jobs...' : "You're offline"}
          </Text>
          <Text style={typography.statusSubtext}>
            {isOnline
              ? "We'll notify you when a job is nearby."
              : 'Go online to start receiving jobs in your area.'}
          </Text>
        </View>
      </View>

      <Pressable
        style={[
          styles.cta,
          { backgroundColor: isOnline ? colors.signalRed : colors.inkCharcoal },
          toggleLoading && styles.ctaDisabled,
        ]}
        onPress={onToggleOnline}
        disabled={toggleLoading}
        accessibilityRole="button"
        accessibilityLabel={isOnline ? 'Go Offline' : 'Go Online'}
      >
        {toggleLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Feather name={isOnline ? 'square' : 'play'} size={16} color="#fff" />
            <Text style={styles.ctaLabel}>{isOnline ? 'Go Offline' : 'Go Online'}</Text>
          </>
        )}
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  greeting: {
    flex: 1,
  },
  greetingSubtext: {
    marginTop: 2,
  },
  earningsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.brandGreenSoft,
    borderRadius: radius.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusCopy: {
    flex: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 16,
    borderRadius: radius.card,
    minHeight: 54,
  },
  ctaDisabled: {
    opacity: 0.75,
  },
  ctaLabel: {
    ...typography.button,
    color: '#fff',
  },
});
