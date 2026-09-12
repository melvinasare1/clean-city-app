import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors } from '@platform/shared-theme';
import { useAuth } from '@/hooks/useAuth';
import { useDriverEarnings } from '@/hooks/useDriverEarnings';
import type { DriverStackParamList } from '@/navigation/types';
import { styles } from './daily-earnings-details-screen.styles';

type Props = {
  navigation: NativeStackNavigationProp<DriverStackParamList, 'DailyEarningsDetails'>;
};

function formatMoney(value: number): string {
  return `¢${value.toFixed(2)}`;
}

function formatOnlineTime(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatDateSubtitle(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export const DailyEarningsDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const { user } = useAuth();
  const selectedDate = useMemo(() => new Date(), []);
  const driverId = user?.id ?? '';
  const {
    totalEarnings,
    jobsCompleted,
    onlineTimeMs,
    averageEarnings,
    jobs,
    loading,
  } = useDriverEarnings(driverId, selectedDate);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color={colors.inkPrimary} />
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Today's earnings</Text>
          <Text style={styles.headerSubtitle}>{formatDateSubtitle(selectedDate)}</Text>
        </View>

        <Pressable
          style={styles.headerButton}
          onPress={() => {
            // Follow-up: wire a date picker to selectedDate.
          }}
          accessibilityRole="button"
          accessibilityLabel="Choose date"
        >
          <Feather name="calendar" size={18} color={colors.inkPrimary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.brandGreen} />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total earnings</Text>
            <Text style={styles.summaryTotal}>{formatMoney(totalEarnings)}</Text>

            <View style={styles.summaryDivider} />

            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <View style={styles.statIcon}>
                  <Feather name="briefcase" size={16} color={colors.brandGreen} />
                </View>
                <Text style={styles.statValue}>{jobsCompleted}</Text>
                <Text style={styles.statLabel}>Jobs completed</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statColumn}>
                <View style={styles.statIcon}>
                  <Feather name="clock" size={16} color={colors.brandGreen} />
                </View>
                <Text style={styles.statValue}>{formatOnlineTime(onlineTimeMs)}</Text>
                <Text style={styles.statLabel}>Online time</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statColumn}>
                <View style={styles.statIcon}>
                  <Feather name="bar-chart-2" size={16} color={colors.brandGreen} />
                </View>
                <Text style={styles.statValue}>{formatMoney(averageEarnings)}</Text>
                <Text style={styles.statLabel}>Average earnings</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Completed jobs</Text>

          {jobs.map((job) => (
            <View key={job.id} style={styles.jobCard}>
              <Text style={styles.jobTime}>{job.timeLabel}</Text>
              <View style={styles.jobRail} />
              <View style={styles.jobCopy}>
                <Text style={styles.jobTitle}>Delivery • {job.bookingIdLabel}</Text>
                {job.routeLabel ? (
                  <Text style={styles.jobRoute} numberOfLines={1}>
                    {job.routeLabel}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.jobFare}>{formatMoney(job.fare)}</Text>
              <Feather name="chevron-right" size={16} color={colors.inkSecondary} />
            </View>
          ))}

          <View style={styles.infoBanner}>
            <View style={styles.infoIcon}>
              <Feather name="info" size={16} color={colors.inkSecondary} />
            </View>
            <View style={styles.infoCopy}>
              <Text style={styles.infoTitle}>Earnings update in real time</Text>
              <Text style={styles.infoBody}>
                Completed jobs and earnings will appear here as you go.
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};
