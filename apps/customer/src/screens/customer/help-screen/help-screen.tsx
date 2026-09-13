import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components';
import { COLORS } from '@/lib/constants';
import { styles } from './help-screen.styles';

export const HelpScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <AppText style={styles.title}>Help</AppText>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons
              name="help-circle-outline"
              size={28}
              color={COLORS.primary}
            />
          </View>
          <AppText style={styles.heading}>Help is on the way</AppText>
          <AppText style={styles.body}>
            Support articles and FAQs will live here soon. For now, you can
            still reach us from Profile or from the options menu on Bookings.
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
};
