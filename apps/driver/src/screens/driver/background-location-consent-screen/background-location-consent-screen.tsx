import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@platform/shared-theme';
import { AppButton } from '@/components';
import {
  acknowledgeBackgroundLocation,
  markResumeOnlineAfterConsent,
  requestOnlineLocationPermissions,
} from '@/lib/driver-background-location';
import type { DriverStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<DriverStackParamList, 'BackgroundLocationConsent'>;

export const BackgroundLocationConsentScreen: React.FC<Props> = ({ navigation }) => {
  const [submitting, setSubmitting] = useState(false);

  const handleAcknowledge = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await acknowledgeBackgroundLocation();
      const permitted = await requestOnlineLocationPermissions();
      if (!permitted) return;
      markResumeOnlineAfterConsent();
      navigation.goBack();
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Could not save your acknowledgment';
      Alert.alert('Error', msg);
    } finally {
      setSubmitting(false);
    }
  }, [navigation, submitting]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <Feather name="map-pin" size={32} color={colors.brandGreen} />
        </View>
        <Text style={styles.title}>Location sharing while online</Text>
        <Text style={styles.body}>
          Going online turns on continuous background location tracking — not only during
          active jobs — so dispatch can see nearby available drivers and send you work.
        </Text>
        <Text style={styles.body}>
          Sharing stops the moment you go offline. We do not use this location for
          advertising, and customers never see this live availability feed.
        </Text>
        <View style={styles.callout}>
          <Feather name="info" size={18} color={colors.inkPrimary} />
          <Text style={styles.calloutText}>
            After you tap the button below, your phone will ask for location access,
            including while the app is in the background.
          </Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <AppButton
          title="I understand — enable location sharing"
          onPress={() => {
            void handleAcknowledge();
          }}
          loading={submitting}
        />
        <AppButton
          title="Not now"
          variant="text"
          onPress={() => navigation.goBack()}
          disabled={submitting}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceWhite,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    ...typography.headline,
    fontSize: 22,
    color: colors.inkPrimary,
  },
  body: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.inkSecondary,
  },
  callout: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.brandGreenSoft,
    borderRadius: radius.card,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  calloutText: {
    ...typography.body,
    flex: 1,
    color: colors.inkPrimary,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
