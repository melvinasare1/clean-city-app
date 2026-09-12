import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import {
  CompositeNavigationProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors } from '@platform/shared-theme';
import { useAuth } from '@/hooks/useAuth';
import { useDriverEarnings } from '@/hooks/useDriverEarnings';
import {
  canShiftForward,
  EARNINGS_PERIODS,
  formatPayoutDate,
  formatPeriodLabel,
  nextPayoutDate,
  rangeForPeriod,
  shiftAnchor,
  type EarningsPeriod,
} from '@/lib/earnings-period';
import type { DriverStackParamList, DriverTabParamList } from '@/navigation/types';
import { styles } from './daily-earnings-details-screen.styles';

const RECENT_JOBS_LIMIT = 5;

type EarningsNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<DriverTabParamList, 'Earnings'>,
  NativeStackNavigationProp<DriverStackParamList>
>;

function formatMoney(value: number): string {
  return `¢${value.toFixed(2)}`;
}

function formatOnlineTime(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

export const DailyEarningsDetailsScreen: React.FC = () => {
  const navigation = useNavigation<EarningsNavigation>();
  const route = useRoute();
  const showBack = route.name === 'DailyEarningsDetails';
  const { user } = useAuth();
  const driverId = user?.id ?? '';

  const [period, setPeriod] = useState<EarningsPeriod>('day');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showAllJobs, setShowAllJobs] = useState(false);

  const range = useMemo(() => rangeForPeriod(period, anchorDate), [anchorDate, period]);
  const {
    totalEarnings,
    jobsCompleted,
    onlineTimeMs,
    averageEarningsPerHour,
    jobs,
    loading,
  } = useDriverEarnings(driverId, range.start, range.end);

  const periodLabel = formatPeriodLabel(period, range.start, range.end);
  const canGoForward = canShiftForward(period, anchorDate);
  const visibleJobs = showAllJobs ? jobs : jobs.slice(0, RECENT_JOBS_LIMIT);
  const hasMoreJobs = jobs.length > RECENT_JOBS_LIMIT;
  const payoutDate = useMemo(() => nextPayoutDate(), []);

  const selectPeriod = useCallback((nextPeriod: EarningsPeriod) => {
    setPeriod(nextPeriod);
    setAnchorDate(new Date());
    setShowAllJobs(false);
    setShowDatePicker(false);
  }, []);

  const goPrevious = useCallback(() => {
    if (period === 'all') return;
    setAnchorDate((current) => shiftAnchor(current, period, -1));
    setShowAllJobs(false);
  }, [period]);

  const goNext = useCallback(() => {
    if (!canGoForward) return;
    setAnchorDate((current) => shiftAnchor(current, period, 1));
    setShowAllJobs(false);
  }, [canGoForward, period]);

  const onDatePicked = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type === 'dismissed' || !date) return;
    setAnchorDate(date);
    setShowAllJobs(false);
  }, []);

  const openJob = useCallback(
    (jobId: string) => {
      navigation.navigate('DriverJobDetail', { jobId });
    },
    [navigation]
  );

  const openPayouts = useCallback(() => {
    navigation.navigate('Payouts');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {showBack ? (
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color={colors.inkPrimary} />
        </Pressable>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Earnings</Text>
          <Text style={styles.subtitle}>Track your earnings and performance</Text>
        </View>

        <View style={styles.periodBar} accessibilityRole="tablist">
          {EARNINGS_PERIODS.map((item) => {
            const selected = item.id === period;
            return (
              <Pressable
                key={item.id}
                style={[styles.periodTab, selected && styles.periodTabSelected]}
                onPress={() => selectPeriod(item.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={item.label}
              >
                <Text style={[styles.periodTabLabel, selected && styles.periodTabLabelSelected]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {period !== 'all' ? (
          <View style={styles.dateNav}>
            <Pressable
              style={styles.dateNavButton}
              onPress={goPrevious}
              accessibilityRole="button"
              accessibilityLabel="Previous period"
            >
              <Feather name="chevron-left" size={18} color={colors.inkPrimary} />
            </Pressable>

            <Pressable
              style={styles.dateNavLabelWrap}
              onPress={() => setShowDatePicker((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel="Choose date"
            >
              <Text style={styles.dateNavLabel}>{periodLabel}</Text>
              <Feather name="chevron-down" size={16} color={colors.inkSecondary} />
            </Pressable>

            <Pressable
              style={[styles.dateNavButton, !canGoForward && styles.dateNavButtonDisabled]}
              onPress={goNext}
              disabled={!canGoForward}
              accessibilityRole="button"
              accessibilityLabel="Next period"
            >
              <Feather
                name="chevron-right"
                size={18}
                color={canGoForward ? colors.inkPrimary : colors.inkSecondary}
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.dateNav}>
            <Text style={styles.dateNavLabel}>{periodLabel}</Text>
          </View>
        )}

        {showDatePicker && period !== 'all' ? (
          <DateTimePicker
            value={anchorDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={new Date()}
            onChange={onDatePicked}
          />
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.brandGreen} />
          </View>
        ) : (
          <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total earnings</Text>
            <Text style={styles.summaryTotal}>{formatMoney(totalEarnings)}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statColumn}>
                <View style={styles.statIcon}>
                  <Feather name="briefcase" size={16} color={colors.brandGreen} />
                </View>
                <Text style={styles.statValue}>{jobsCompleted}</Text>
                <Text style={styles.statLabel}>Jobs completed</Text>
              </View>

              <View style={styles.statColumn}>
                <View style={styles.statIcon}>
                  <Feather name="clock" size={16} color={colors.brandGreen} />
                </View>
                <Text style={styles.statValue}>{formatOnlineTime(onlineTimeMs)}</Text>
                <Text style={styles.statLabel}>Online time</Text>
              </View>

              <View style={styles.statColumn}>
                <View style={styles.statIcon}>
                  <Feather name="bar-chart-2" size={16} color={colors.brandGreen} />
                </View>
                <Text style={styles.statValue}>{formatMoney(averageEarningsPerHour)}</Text>
                <Text style={styles.statLabel}>Avg. earnings/hr</Text>
              </View>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent jobs</Text>
            {hasMoreJobs && !showAllJobs ? (
              <Pressable
                onPress={() => setShowAllJobs(true)}
                accessibilityRole="button"
                accessibilityLabel="See all jobs"
                style={styles.seeAll}
              >
                <Text style={styles.seeAllLabel}>See all</Text>
                <Feather name="chevron-right" size={14} color={colors.brandGreen} />
              </Pressable>
            ) : null}
          </View>

          {visibleJobs.length === 0 ? (
            <View style={styles.emptyJobs}>
              <Text style={styles.emptyJobsTitle}>No completed jobs yet</Text>
              <Text style={styles.emptyJobsBody}>
                Finished jobs in this period will show up here.
              </Text>
            </View>
          ) : (
            visibleJobs.map((job) => (
              <Pressable
                key={job.id}
                style={styles.jobCard}
                onPress={() => openJob(job.id)}
                accessibilityRole="button"
                accessibilityLabel={`Job ${job.bookingIdLabel}`}
              >
                <View style={styles.jobWhen}>
                  <Text style={styles.jobDate}>{job.dateLabel}</Text>
                  <Text style={styles.jobTime}>{job.timeLabel}</Text>
                </View>
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
              </Pressable>
            ))
          )}

          {jobs.length > 0 ? (
            <Pressable
              style={styles.viewAllRow}
              onPress={() => setShowAllJobs(true)}
              accessibilityRole="button"
              accessibilityLabel="View all jobs for this period"
            >
              <View style={styles.viewAllIcon}>
                <Feather name="file-text" size={18} color={colors.inkPrimary} />
              </View>
              <Text style={styles.viewAllLabel}>View all jobs for this period</Text>
              <Feather name="chevron-right" size={18} color={colors.inkSecondary} />
            </Pressable>
          ) : null}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payouts</Text>
            <Pressable
              onPress={openPayouts}
              accessibilityRole="button"
              accessibilityLabel="See all payouts"
              style={styles.seeAll}
            >
              <Text style={styles.seeAllLabel}>See all</Text>
              <Feather name="chevron-right" size={14} color={colors.brandGreen} />
            </Pressable>
          </View>

          <Pressable
            style={styles.payoutCard}
            onPress={openPayouts}
            accessibilityRole="button"
            accessibilityLabel="Next payout"
          >
            <View style={styles.viewAllIcon}>
              <Feather name="calendar" size={18} color={colors.inkPrimary} />
            </View>
            <View style={styles.payoutCopy}>
              <Text style={styles.payoutTitle}>Next payout</Text>
              <Text style={styles.payoutSubtitle}>{formatPayoutDate(payoutDate)}</Text>
            </View>
            <Text style={styles.payoutAmount}>{formatMoney(totalEarnings)}</Text>
          </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};
