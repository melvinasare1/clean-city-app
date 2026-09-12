import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@platform/shared-theme';
import { useAuth } from '@/hooks/useAuth';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { openDeleteAccountSupport } from '@/lib/delete-account';
import { setDriverNotificationsEnabled } from '@/lib/push';
import { trackEvent } from '@/services/analytics';
import { styles } from './settings-screen.styles';

export const SettingsScreen: React.FC = () => {
  const { user, logout } = useAuth();
  const driverId = user?.id ?? '';
  const profile = useDriverProfile(driverId);
  const [toggling, setToggling] = useState(false);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await openDeleteAccountSupport(user?.id, logout);
      await trackEvent('logout', { screen: 'settings', reason: 'delete_account' });
    } catch (error) {
      console.error('Delete account error:', error);
    }
  }, [logout, user?.id]);

  const handleNotificationsToggle = useCallback(
    async (enabled: boolean) => {
      if (!driverId || toggling) return;
      setToggling(true);
      try {
        await setDriverNotificationsEnabled(driverId, enabled);
      } catch (error) {
        console.error('Notifications toggle error:', error);
        Alert.alert('Could not update notifications', 'Please try again.');
      } finally {
        setToggling(false);
      }
    },
    [driverId, toggling]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.list}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <Feather name="bell" size={18} color={colors.inkPrimary} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowLabel}>Notifications</Text>
            <Text style={styles.rowSubtitle}>
              {profile.notificationsEnabled
                ? 'Job offers and updates'
                : 'Push notifications are off'}
            </Text>
          </View>
          <Switch
            value={profile.notificationsEnabled}
            onValueChange={(value) => {
              void handleNotificationsToggle(value);
            }}
            disabled={!driverId || toggling}
            trackColor={{ false: colors.surfaceMutedIcon, true: colors.brandGreenSoft }}
            thumbColor={profile.notificationsEnabled ? colors.brandGreen : colors.inkSecondary}
            accessibilityLabel="Notifications"
          />
        </View>

        <Pressable
          style={styles.row}
          onPress={() => {
            void handleDeleteAccount();
          }}
          accessibilityRole="button"
          accessibilityLabel="Delete Account"
        >
          <View style={styles.rowIcon}>
            <Feather name="trash-2" size={18} color={colors.signalRed} />
          </View>
          <View style={styles.rowCopy}>
            <Text style={[styles.rowLabel, styles.destructiveLabel]}>Delete Account</Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.inkSecondary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};
