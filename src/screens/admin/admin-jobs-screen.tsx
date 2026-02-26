import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/admin';
import { getApiBaseUrl } from '@/lib/apiBase';
import { COLORS } from '@/lib/constants';
import { AppText, AppButton, AppTextInput } from '@/components';
import {
  getDrivers,
  getJobsList,
  assignJob,
  type AdminDriver,
  type AdminJob,
  type AssignmentStatus,
} from '@/services/admin-api';

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function assignmentBadge(status: AssignmentStatus): string {
  switch (status) {
    case 'unassigned':
      return 'Unassigned';
    case 'assigned':
      return 'Assigned (Awaiting Acceptance)';
    case 'accepted':
      return 'Accepted';
    case 'reassigned':
      return 'Reassigned';
    default:
      return status;
  }
}

export const AdminJobsScreen: React.FC = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<AdminDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [date, setDate] = useState(() => formatDateForInput(new Date()));
  const [filterAssignmentStatus, setFilterAssignmentStatus] = useState<string>('');
  const [filterDriverId, setFilterDriverId] = useState<string>('');
  const [filterWindowId, setFilterWindowId] = useState<string>('');
  const [assignModalJob, setAssignModalJob] = useState<AdminJob | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const activeDrivers = drivers.filter((d) => d.isActive);

  const loadDrivers = useCallback(async () => {
    try {
      setDriversLoading(true);
      const list = await getDrivers();
      setDrivers(list);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load drivers');
    } finally {
      setDriversLoading(false);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    if (!date) return;
    try {
      setJobsLoading(true);
      const list = await getJobsList({
        date,
        ...(filterAssignmentStatus ? { assignmentStatus: filterAssignmentStatus } : {}),
        ...(filterDriverId ? { driverId: filterDriverId } : {}),
        ...(filterWindowId ? { windowId: filterWindowId } : {}),
      });
      setJobs(list);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setJobsLoading(false);
    }
  }, [date, filterAssignmentStatus, filterDriverId, filterWindowId]);

  useEffect(() => {
    if (isAdmin(user)) {
      loadDrivers();
    }
  }, [user, loadDrivers]);

  const handleApplyFilters = useCallback(() => {
    loadJobs();
  }, [loadJobs]);

  const openAssignModal = (job: AdminJob) => {
    if (job.jobStatus === 'completed') {
      Alert.alert('Cannot assign', 'Completed jobs cannot be assigned or reassigned.');
      return;
    }
    if (job.paymentStatus !== 'paid') {
      Alert.alert('Cannot assign', 'Only paid jobs can be assigned.');
      return;
    }
    setAssignModalJob(job);
    setSelectedDriverId(job.assignedTo || null);
  };

  const closeAssignModal = () => {
    if (!assigning) {
      setAssignModalJob(null);
      setSelectedDriverId(null);
    }
  };

  const handleConfirmAssign = async () => {
    if (!assignModalJob || !user?.id || !selectedDriverId) {
      Alert.alert('Error', 'Please select a driver.');
      return;
    }
    if (assignModalJob.jobStatus === 'completed') {
      Alert.alert('Cannot assign', 'Completed jobs cannot be assigned.');
      return;
    }
    setAssigning(true);
    try {
      const updated = await assignJob({
        jobId: assignModalJob.id,
        driverId: selectedDriverId,
        adminId: user.id,
      });
      setJobs((prev) =>
        prev.map((j) => (j.id === updated.id ? updated : j))
      );
      closeAssignModal();
      Alert.alert('Success', 'Job assigned successfully.');
    } catch (e) {
      Alert.alert(
        'Assignment failed',
        e instanceof Error ? e.message : 'Failed to assign job'
      );
    } finally {
      setAssigning(false);
    }
  };

  const getDriverName = (driverId: string | null): string => {
    if (!driverId) return '';
    const d = drivers.find((x) => x.id === driverId);
    return d ? d.name : driverId;
  };

  if (!isAdmin(user)) {
    return (
      <View style={styles.container}>
        <AppText style={styles.errorText}>Admin access required</AppText>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Filters */}
      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>Filters</AppText>
        <AppTextInput
          placeholder="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          style={styles.input}
        />
        <AppTextInput
          placeholder="Assignment status (unassigned, assigned, accepted, reassigned)"
          value={filterAssignmentStatus}
          onChangeText={setFilterAssignmentStatus}
          style={styles.input}
        />
        <AppTextInput
          placeholder="Driver ID (filter by assigned driver)"
          value={filterDriverId}
          onChangeText={setFilterDriverId}
          style={styles.input}
        />
        <AppTextInput
          placeholder="Window ID"
          value={filterWindowId}
          onChangeText={setFilterWindowId}
          style={styles.input}
        />
        <AppButton
          title={jobsLoading ? 'Loading...' : 'Load jobs'}
          onPress={handleApplyFilters}
          disabled={jobsLoading || !date}
          loading={jobsLoading}
          buttonStyle={styles.applyButton}
        />
      </View>

      {/* Job list */}
      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>Jobs</AppText>
        {jobsLoading && jobs.length === 0 ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={styles.loader} />
        ) : jobs.length === 0 ? (
          <AppText style={styles.emptyText}>No jobs for this date and filters.</AppText>
        ) : (
          jobs.map((job) => {
            const canAssign = job.paymentStatus === 'paid' && job.jobStatus !== 'completed';
            const isCompleted = job.jobStatus === 'completed';
            return (
              <View key={job.id} style={styles.card}>
                <View style={styles.cardRow}>
                  <AppText style={styles.label}>Location</AppText>
                  <AppText style={styles.value}>{job.location || '–'}</AppText>
                </View>
                <View style={styles.cardRow}>
                  <AppText style={styles.label}>Window</AppText>
                  <AppText style={styles.value}>{job.windowLabel || job.windowId || '–'}</AppText>
                </View>
                <View style={styles.cardRow}>
                  <AppText style={styles.label}>Date</AppText>
                  <AppText style={styles.value}>{job.scheduledDate}</AppText>
                </View>
                <View style={styles.cardRow}>
                  <AppText style={styles.label}>Payment</AppText>
                  <AppText style={styles.value}>{job.paymentStatus}</AppText>
                </View>
                <View style={styles.cardRow}>
                  <AppText style={styles.label}>Job status</AppText>
                  <AppText style={styles.value}>{job.jobStatus}</AppText>
                </View>
                <View style={styles.cardRow}>
                  <AppText style={styles.label}>Assignment</AppText>
                  <AppText style={styles.badge}>{assignmentBadge(job.assignmentStatus)}</AppText>
                </View>
                {job.assignedTo && (
                  <View style={styles.cardRow}>
                    <AppText style={styles.label}>Assigned to</AppText>
                    <AppText style={styles.value}>{getDriverName(job.assignedTo)}</AppText>
                  </View>
                )}
                <View style={styles.cardRow}>
                  <AppButton
                    title={job.assignmentStatus === 'unassigned' ? 'Assign Driver' : 'Reassign'}
                    onPress={() => openAssignModal(job)}
                    disabled={!canAssign}
                    variant={isCompleted ? 'secondary' : 'primary'}
                    buttonStyle={styles.assignButton}
                  />
                </View>
                {isCompleted && (
                  <AppText style={styles.warningText}>Completed – cannot assign</AppText>
                )}
                {job.paymentStatus !== 'paid' && (
                  <AppText style={styles.warningText}>Unpaid – assign when paid</AppText>
                )}
              </View>
            );
          })
        )}
      </View>

      {/* Assign modal */}
      <Modal
        visible={!!assignModalJob}
        transparent
        animationType="fade"
        onRequestClose={closeAssignModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <AppText style={styles.modalTitle}>Select driver</AppText>
            <ScrollView style={styles.driverList}>
              {activeDrivers.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[
                    styles.driverOption,
                    selectedDriverId === d.id && styles.driverOptionSelected,
                  ]}
                  onPress={() => setSelectedDriverId(d.id)}
                >
                  <AppText>{d.name}</AppText>
                  {selectedDriverId === d.id && <AppText style={styles.check}>✓</AppText>}
                </TouchableOpacity>
              ))}
            </ScrollView>
            {activeDrivers.length === 0 && !driversLoading && (
              <AppText style={styles.emptyText}>No active drivers</AppText>
            )}
            <View style={styles.modalActions}>
              <AppButton
                title="Cancel"
                onPress={closeAssignModal}
                disabled={assigning}
                variant="secondary"
                buttonStyle={styles.modalButton}
              />
              <AppButton
                title={assigning ? 'Assigning...' : 'Confirm'}
                onPress={handleConfirmAssign}
                disabled={assigning || !selectedDriverId}
                loading={assigning}
                buttonStyle={styles.modalButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.text,
  },
  input: {
    marginBottom: 12,
  },
  applyButton: {
    marginTop: 8,
  },
  loader: {
    marginVertical: 24,
  },
  emptyText: {
    color: COLORS.textSecondary,
    marginTop: 8,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cardRow: {
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: 14,
    color: COLORS.text,
  },
  badge: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  assignButton: {
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 32,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.text,
  },
  driverList: {
    maxHeight: 280,
    marginBottom: 16,
  },
  driverOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.background,
    borderRadius: 8,
    marginBottom: 8,
  },
  driverOptionSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#E8F5E9',
  },
  check: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  modalButton: {
    minWidth: 100,
  },
});
