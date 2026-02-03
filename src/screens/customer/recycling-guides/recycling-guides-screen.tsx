import React, { useState, useEffect } from 'react';
import { View, Image, Switch, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { doc, getDoc } from 'firebase/firestore';
import { AppText, AppButton } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { CustomerStackParamList } from '@/navigation/types';
import { styles } from './recycling-guides-screen.styles';
import { setDocAtPath } from '@/lib/utils';
import { trackEvent } from '@/services/analytics';
import { db } from '@/lib/firebase';
import { COLORS } from '@/lib/constants';

type RecyclingGuidesScreenProps = NativeStackScreenProps<
  CustomerStackParamList,
  'RecyclingGuides'
>;

const SCREEN = 'recycling_guides';

export const RecyclingGuidesScreen: React.FC<RecyclingGuidesScreenProps> = ({
  navigation,
}) => {
  const { user } = useAuth();
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasOptedIn, setHasOptedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleStayUpdated = async () => {
    if (!user) {
      return;
    }

    try {
      setIsSaving(true);

      // Only save if toggle is enabled
      if (notifyEnabled) {
        await setDocAtPath(['profiles', user.id], {
          recyclingGuideOptIn: true,
        }, {
          merge: true,
          addTimestamps: true,
        });

        await trackEvent('recycling_guide_opt_in', {
          screen: SCREEN,
          opted_in: true,
        });
      } else {
        await trackEvent('recycling_guide_opt_in', {
          screen: SCREEN,
          opted_in: false,
        });
      }

      // Navigate back
      navigation.goBack();
    } catch (error) {
      console.error('Error saving recycling guide preference:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleMaybeLater = () => {
    trackEvent('recycling_guide_dismissed', {
      screen: SCREEN,
    }).catch(() => {});
    navigation.goBack();
  };

  // Load user's opt-in status
  useEffect(() => {
    const loadOptInStatus = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, 'profiles', user.id);
        const profileSnap = await getDoc(profileRef);

        if (profileSnap.exists()) {
          const data = profileSnap.data();
          const optedIn = data?.recyclingGuideOptIn === true;
          setHasOptedIn(optedIn);
        }
      } catch (error) {
        console.error('Error loading opt-in status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOptInStatus();
  }, [user?.id]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.imageContainer}>
        <View style={styles.imagePlaceholder}>
          <AppText style={styles.imagePlaceholderText}>🌱</AppText>
        </View>
      </View>

      <View style={styles.content}>
        <AppText style={styles.title}>Recycling Guides Coming Soon!</AppText>
        
        {hasOptedIn ? (
          <>
            <View style={styles.successBadge}>
              <AppText style={styles.successBadgeText}>✓ You're on the waitlist</AppText>
            </View>
            
            <AppText style={styles.description}>
              Great! You've already joined the waitlist. We'll notify you as soon as our recycling guides are ready.
            </AppText>
          </>
        ) : (
          <>
            <AppText style={styles.description}>
              We're building simple, local recycling guides to help you recycle smarter. 
              Join the waitlist to be the first to know when they're ready.
            </AppText>

            <View style={styles.toggleRow}>
              <AppText style={styles.toggleLabel}>Notify me when available</AppText>
              <Switch
                value={notifyEnabled}
                onValueChange={setNotifyEnabled}
                trackColor={{ false: '#d1d5db', true: '#66BB6A' }}
                thumbColor={notifyEnabled ? '#2E7D32' : '#f4f3f4'}
              />
            </View>

            <AppButton
              title="Stay Updated"
              onPress={handleStayUpdated}
              loading={isSaving}
              disabled={isSaving}
              buttonStyle={styles.primaryButton}
            />

            <TouchableOpacity
              onPress={handleMaybeLater}
              disabled={isSaving}
              style={styles.secondaryButton}
            >
              <AppText style={styles.secondaryButtonText}>Maybe later</AppText>
            </TouchableOpacity>
          </>
        )}
      </View>

      {hasOptedIn && (
        <View style={styles.bottomButtonContainer}>
          <AppButton
            title="Got it"
            onPress={() => navigation.goBack()}
            buttonStyle={styles.primaryButton}
          />
        </View>
      )}
    </ScrollView>
  );
};
