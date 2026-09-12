import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '@/hooks/useAuth';
import { useDriverApproved } from '@/hooks/useDriverApproved';
import { DriverApprovalBanner } from '@/components/driver/DriverApprovalBanner';
import { styles } from './driver-job-details-screen.styles';
import {
  getJobSingle,
  startJob,
  completeJob,
  type DriverJob,
} from '@/services/driver-api';

type DriverStackParamList = {
  DriverHome: undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
};

type DriverJobDetailScreenProps = {
  navigation: NativeStackNavigationProp<DriverStackParamList, 'DriverJobDetail'>;
  route: RouteProp<DriverStackParamList, 'DriverJobDetail'>;
};

export const DriverJobDetailScreen: React.FC<DriverJobDetailScreenProps> = ({ navigation, route }) => {
  const { jobId } = route.params;
  const { user } = useAuth();
  const { isApproved, showPendingAlert } = useDriverApproved();
  const driverId = user?.id ?? '';

  const [job, setJob] = useState<DriverJob & { addressSnapshot?: { addressLine1: string; area: string; phoneNumber: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    if (!driverId || !jobId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getJobSingle(jobId, driverId);
      setJob(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load job');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [driverId, jobId]);

  useFocusEffect(
    useCallback(() => {
      loadJob();
    }, [loadJob])
  );

  const guardAction = (action: () => void) => {
    if (!isApproved) {
      showPendingAlert();
      return;
    }
    action();
  };

  const handleStartJob = async () => {
    if (!driverId || !jobId) return;
    setActionLoading(true);
    try {
      await startJob(jobId, driverId);
      await loadJob();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to start job');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteJob = async () => {
    if (!driverId || !jobId) return;
    if (job?.paymentStatus !== 'paid') {
      Alert.alert('Cannot complete', 'This job must be paid before you can complete it.');
      return;
    }
    setActionLoading(true);
    try {
      await completeJob(jobId, driverId);
      await loadJob();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to complete job');
    } finally {
      setActionLoading(false);
    }
  };

  const canStart = job && job.jobStatus !== 'in_progress' && job.jobStatus !== 'completed';
  const canComplete =
    job && job.jobStatus === 'in_progress' && job.paymentStatus === 'paid';

  const address =
    job?.addressSnapshot?.addressLine1 || job?.location || 'No address';
  const phone = job?.addressSnapshot?.phoneNumber;

  if (loading) {
    return (
      <View style={[styles.container, styles.content]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error || !job) {
    return (
      <View style={[styles.container, styles.content]}>
        <Text style={styles.placeholderText}>{error || 'Job not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {!isApproved && <DriverApprovalBanner />}
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Job Details</Text>
          <View style={[styles.statusBadge, { backgroundColor: job.jobStatus === 'completed' ? '#4CAF50' : job.jobStatus === 'in_progress' ? '#FF9800' : '#2196F3' }]}>
            <Text style={styles.statusText}>
              {job.jobStatus.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📍 Pickup Location</Text>
          <Text style={styles.address}>{address}</Text>
          <Text style={styles.timeWindow}>⏰ {job.windowLabel}</Text>
        </View>

        {phone ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>👤 Customer</Text>
            <Text style={styles.infoText}>Phone: {phone}</Text>
            <TouchableOpacity
              style={styles.actionButtonSecondary}
              onPress={() => guardAction(() => Linking.openURL(`tel:${phone}`))}
            >
              <Text style={styles.actionButtonTextSecondary}>Call Customer</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🗑️ Items</Text>
          {(job.items?.length ?? 0) > 0
            ? job.items!.map((item, i) => (
                <Text key={i} style={styles.binItem}>
                  • {item.type}: {item.quantity} × GHS {item.unitPrice}
                </Text>
              ))
            : (
              <Text style={styles.placeholderText}>No items listed</Text>
            )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <Text style={styles.earnings}>{job.paymentStatus.toUpperCase()}</Text>
        </View>

        {canStart && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => guardAction(handleStartJob)}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Start Job</Text>
            )}
          </TouchableOpacity>
        )}

        {canComplete && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => guardAction(handleCompleteJob)}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Complete Job</Text>
            )}
          </TouchableOpacity>
        )}

        {job.paymentStatus !== 'paid' && job.jobStatus === 'in_progress' && (
          <Text style={styles.placeholderText}>
            Complete is only available when payment status is paid.
          </Text>
        )}
      </View>
    </ScrollView>
  );
};
