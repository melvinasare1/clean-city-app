import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { styles } from './driver-job-list-screen.styles';
import { getDriverJobs, type DriverJob } from '@/services/driver-api';

type DriverStackParamList = {
  DriverHome: undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
};

type DriverJobListScreenProps = {
  navigation: NativeStackNavigationProp<DriverStackParamList, 'DriverJobList'>;
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

function getStatusColor(status: string): string {
  switch (status) {
    case 'assigned':
    case 'scheduled':
      return '#2196F3';
    case 'in_progress':
      return '#FF9800';
    case 'completed':
      return COLORS.success;
    default:
      return COLORS.textSecondary;
  }
}

export const DriverJobListScreen: React.FC<DriverJobListScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<DriverJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const driverId = user?.id ?? '';
  const date = todayYYYYMMDD();

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await getDriverJobs(driverId, date);
      setJobs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [driverId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = groupByWindow(jobs);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Assigned Jobs</Text>
        {error && <Text style={styles.placeholderText}>{error}</Text>}
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 16 }} />
        ) : (
          Object.entries(grouped).map(([windowLabel, windowJobs]) => (
            <View key={windowLabel} style={{ marginBottom: 12 }}>
              <Text style={[styles.title, { fontSize: 14, marginBottom: 6 }]}>{windowLabel}</Text>
              {windowJobs.map((job) => (
                <TouchableOpacity
                  key={job.id}
                  style={styles.card}
                  onPress={() => navigation.navigate('DriverJobDetail', { jobId: job.id })}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardAddress}>📍 {job.location || 'No address'}</Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: getStatusColor(job.jobStatus) },
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {job.jobStatus.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardDetails}>
                    <Text style={styles.cardTime}>⏰ {job.windowLabel}</Text>
                    <Text style={styles.cardEarnings}>💳 {job.paymentStatus}</Text>
                  </View>
                  <Text style={styles.cardNote}>Tap to view details</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))
        )}
        {!loading && jobs.length === 0 && !error && (
          <View style={styles.placeholderCard}>
            <Text style={styles.placeholderText}>No jobs assigned for today</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};