import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, sizes } from '@/theme/driver-home';
import { StatusPill } from './StatusPill';

type Props = {
  isOnline: boolean;
  onToggleOnline: () => void;
  onMenuPress: () => void;
  onNotificationsPress: () => void;
  hasUnreadNotifications?: boolean;
  topInset?: number;
  toggleDisabled?: boolean;
};

export function TopBar({
  isOnline,
  onToggleOnline,
  onMenuPress,
  onNotificationsPress,
  hasUnreadNotifications = false,
  topInset = 0,
  toggleDisabled,
}: Props) {
  return (
    <View style={[styles.row, { top: 8 + topInset }]}>
      <Pressable
        style={styles.iconButton}
        onPress={onMenuPress}
        accessibilityRole="button"
        accessibilityLabel="Open menu"
      >
        <Feather name="menu" size={20} color={colors.inkPrimary} />
      </Pressable>

      <StatusPill isOnline={isOnline} onPress={onToggleOnline} disabled={toggleDisabled} />

      <Pressable
        style={styles.iconButton}
        onPress={onNotificationsPress}
        accessibilityRole="button"
        accessibilityLabel="Notifications"
      >
        <Feather name="bell" size={20} color={colors.inkPrimary} />
        {hasUnreadNotifications && <View style={styles.badge} />}
      </Pressable>
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
  iconButton: {
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
