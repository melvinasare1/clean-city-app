import React, { useCallback, useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../../hooks/useAuth';
import { useDriverStatus } from '@/contexts/driver-status-context';
import { useDriverApproved } from '@/hooks/useDriverApproved';
import { DriverApprovalBanner } from '@/components/driver/DriverApprovalBanner';
import { styles } from './driver-home-screen.styles';
import { trackEvent } from '@/services/analytics';
import {
  getDriverJobs,
  startShift,
  endShift,
  type DriverJob,
  type DriverShift,
} from '@/services/driver-api';
import { openDeleteAccountSupport } from '@/lib/delete-account';

type DriverStackParamList = {
  DriverHome: undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
};

type DriverHomeScreenProps = {
  navigation: NativeStackNavigationProp<DriverStackParamList, 'DriverHome'>;
};

function todayYYYYMMDD(): string {
  return new Date().toISOString().slice(0, 10);
}

function groupByWindow(jobs: DriverJob[]): Record<string, DriverJob[]> {
  const map: Record<string, DriverJob[]> = {};
  for (const job of jobs) {
    const key = job.windowLabel || 'Other';
    if (!map[key]) map[key] = [];
    map[key].push(job);
  }
  return map;
}

export const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const { refreshDriverStatus } = useDriverStatus();
  const { isApproved, showPendingAlert } = useDriverApproved();
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [endShiftLoading, setEndShiftLoading] = useState(false);
  const [shift, setShift] = useState<DriverShift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gateChecked = useRef(false);

  const driverId = user?.id ?? '';
  const date = todayYYYYMMDD();

  useEffect(() => {
    if (gateChecked.current || !driverId) return;
    gateChecked.current = true;
    refreshDriverStatus();
  }, [driverId, refreshDriverStatus]);

  const loadJobs = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getDriverJobs(driverId, date);
      setJobs(list);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load jobs';
      setError(msg);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [driverId, date]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const guardAction = (action: () => void) => {
    if (!isApproved) {
      showPendingAlert();
      return;
    }
    action();
  };

  const handleStartShift = async () => {
    if (!driverId) return;
    setShiftLoading(true);
    try {
      const s = await startShift(driverId);
      setShift(s);
      await trackEvent('driver_start_shift', { screen: 'driver_home' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start shift';
      Alert.alert('Error', msg);
    } finally {
      setShiftLoading(false);
    }
  };

  const handleEndShift = async () => {
    if (!driverId) return;
    setEndShiftLoading(true);
    try {
      const s = await endShift(driverId);
      setShift(s);
      await trackEvent('driver_end_shift', { screen: 'driver_home' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to end shift';
      Alert.alert('Error', msg);
    } finally {
      setEndShiftLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      await trackEvent('logout', { screen: 'settings' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await openDeleteAccountSupport(user?.id, logout);
      await trackEvent('logout', { screen: 'settings', reason: 'delete_account' });
    } catch (error) {
      console.error('Delete account error:', error);
    }
  };

  const grouped = groupByWindow(jobs);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Driver Dashboard</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
      </View>

      {!isApproved && <DriverApprovalBanner />}

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{loading ? '–' : jobs.length}</Text>
            <Text style={styles.statLabel}>Today's Jobs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>–</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={[styles.actionButton, !isApproved && styles.actionButtonDisabled]}
            onPress={() => guardAction(handleStartShift)}
            disabled={shiftLoading || !!shift?.shiftStartedAt}
          >
            {shiftLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>
                {shift?.shiftStartedAt ? '✓ Shift Started' : '▶ Start Shift'}
              </Text>
            )}
          </TouchableOpacity>

          {shift?.shiftStartedAt && !shift?.shiftEndedAt && (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonSecondary,
                !isApproved && styles.actionButtonDisabled,
              ]}
              onPress={() => guardAction(handleEndShift)}
              disabled={endShiftLoading}
            >
              {endShiftLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.actionButtonTextSecondary}>End Shift</Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('DriverJobList')}
          >
            <Text style={styles.actionButtonText}>📋 View All Jobs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.actionButtonSecondary,
              !isApproved && styles.actionButtonDisabled,
            ]}
            onPress={() => guardAction(() => {})}
          >
            <Text style={styles.actionButtonTextSecondary}>🔍 Find Available Jobs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Schedule</Text>
          {error && (
            <Text style={styles.placeholderText}>{error}</Text>
          )}
          {loading ? (
            <ActivityIndicator style={{ marginVertical: 12 }} />
          ) : Object.keys(grouped).length === 0 ? (
            <Text style={styles.placeholderText}>
              Your assigned jobs for today will appear here
            </Text>
          ) : (
            Object.entries(grouped).map(([windowLabel, windowJobs]) => (
              <View key={windowLabel} style={{ marginBottom: 12 }}>
                <Text style={[styles.cardTitle, { fontSize: 14, marginBottom: 6 }]}>
                  {windowLabel}
                </Text>
                {windowJobs.map((job) => (
                  <TouchableOpacity
                    key={job.id}
                    style={[styles.actionButton, styles.actionButtonSecondary, { marginBottom: 6 }]}
                    onPress={() => navigation.navigate('DriverJobDetail', { jobId: job.id })}
                  >
                    <Text style={styles.actionButtonTextSecondary} numberOfLines={1}>
                      📍 {job.location || 'No address'} · {job.jobStatus}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleDeleteAccount}>
          <Text style={styles.logoutButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
