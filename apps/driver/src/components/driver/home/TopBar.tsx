import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, sizes } from '@platform/shared-theme';
import { StatusPill } from './StatusPill';

type Props = {
  isOnline: boolean;
  onToggleOnline: () => void;
  onMenuPress?: () => void;
  onNotificationsPress?: () => void;
  hasUnreadNotifications?: boolean;
  priority?: number | null;
  topInset?: number;
  toggleDisabled?: boolean;
};

export function TopBar({
  isOnline,
  onToggleOnline,
  onMenuPress,
  onNotificationsPress,
  hasUnreadNotifications = false,
  priority,
  topInset = 0,
  toggleDisabled,
}: Props) {
  const showPriority = priority != null;
  const showBell = Boolean(onNotificationsPress) && !showPriority;
  const showRight = showPriority || showBell;
  const showLeft = Boolean(onMenuPress) || showRight;

  return (
    <View
      style={[
        styles.row,
        { top: 8 + topInset, justifyContent: showLeft || showRight ? 'space-between' : 'center' },
      ]}
    >
      {onMenuPress ? (
        <Pressable
          style={styles.iconButton}
          onPress={onMenuPress}
          accessibilityRole="button"
          accessibilityLabel="Open menu"
        >
          <Feather name="menu" size={20} color={colors.inkPrimary} />
        </Pressable>
      ) : showRight ? (
        <View style={styles.iconButtonPlaceholder} pointerEvents="none" />
      ) : null}

      <StatusPill isOnline={isOnline} onPress={onToggleOnline} disabled={toggleDisabled} />

      {showPriority ? (
        <View
          style={styles.iconButton}
          accessibilityRole="text"
          accessibilityLabel={`Priority ${priority}`}
        >
          <Text style={styles.priorityLabel}>{priority}</Text>
        </View>
      ) : onNotificationsPress ? (
        <Pressable
          style={styles.iconButton}
          onPress={onNotificationsPress}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <Feather name="bell" size={20} color={colors.inkPrimary} />
          {hasUnreadNotifications && <View style={styles.badge} />}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  iconButtonPlaceholder: {
    width: sizes.topBarButton,
    height: sizes.topBarButton,
  },
    width: sizes.topBarButton,
    height: sizes.topBarButton,
    borderRadius: sizes.topBarButton / 2,
    backgroundColor: colors.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  iconButtonPlaceholder: {
    width: sizes.topBarButton,
    height: sizes.topBarButton,
  },
  priorityLabel: {
    color: colors.inkPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.brandGreenDot,
    borderWidth: 1.5,
    borderColor: colors.surfaceWhite,
  },
});
