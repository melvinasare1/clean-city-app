import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, functions } from '@platform/shared-firebase';
import { colors } from '@platform/shared-theme';
import { mapJobDoc, type JobOffer } from '@/hooks/useAssignedJobOffer';
import {
  formatAddressLines,
  formatWindowPill,
  paymentMethodLabel,
} from '@/lib/job-sheet';
import { callCustomer, openTripOverflowMenu } from '@/lib/trip-overflow';
import type { DriverStackParamList } from '@/navigation/types';
import { styles } from './job-sheet-screen.styles';

type Props = NativeStackScreenProps<DriverStackParamList, 'JobSheet'>;

const cancelAcceptedJobFn = httpsCallable<{ jobId: string }, { ok: boolean }>(
  functions,
  'cancelAcceptedJob'
);
const confirmPickupFn = httpsCallable<{ jobId: string }, { ok: boolean }>(
  functions,
  'confirmPickup'
);

export const JobSheetScreen: React.FC<Props> = ({ navigation, route }) => {
  const { jobId } = route.params;
  const [job, setJob] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'jobs', jobId),
      (snap) => {
        if (!snap.exists()) {
          setJob(null);
        } else {
          setJob(mapJobDoc(snap.id, snap.data() as Parameters<typeof mapJobDoc>[1]));
        }
        setLoading(false);
      },
      (err) => {
        console.error('JobSheet listener error', err);
        setLoading(false);
      }
    );
    return unsub;
  }, [jobId]);

  const busy = confirming || cancelling;
  const address = formatAddressLines({
    addressLine1: job?.addressLine1,
    area: job?.area,
    location: job?.location ?? job?.address,
  });
  const photoUrl = job?.photoUrl?.trim() || null;

  const handleCancel = useCallback(() => {
    void (async () => {
      setCancelling(true);
      try {
        await cancelAcceptedJobFn({ jobId });
        navigation.goBack();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not cancel this job';
        Alert.alert('Error', msg);
      } finally {
        setCancelling(false);
      }
    })();
  }, [jobId, navigation]);

  const handleConfirmPickup = useCallback(async () => {
    setConfirming(true);
    try {
      await confirmPickupFn({ jobId });
      navigation.goBack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not confirm pickup';
      Alert.alert('Error', msg);
    } finally {
      setConfirming(false);
    }
  }, [jobId, navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.headerSide}
        >
          <Feather name="chevron-left" size={26} color={colors.inkPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Job details</Text>
        <Pressable
          onPress={() =>
            openTripOverflowMenu({
              phone: job?.phoneNumber,
              onCancel: handleCancel,
              getHelpLabel: 'Get Help',
              cancelMenuLabel: 'Cancel Job',
              cancelTitle: 'Cancel this job?',
              cancelConfirmLabel: 'Cancel Job',
            })
          }
          disabled={busy || !job}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="More job actions"
          style={styles.headerSide}
        >
          <Feather name="more-horizontal" size={22} color={colors.inkPrimary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color={colors.brandGreen} />
        </View>
      ) : !job ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>This job is no longer available.</Text>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.windowPill}>
              <Feather name="clock" size={16} color={colors.brandGreen} />
              <Text style={styles.windowPillText}>
                {formatWindowPill(job.windowId, job.windowLabel)}
              </Text>
            </View>

            <View style={styles.card}>
              <View style={styles.customerRow}>
                <View style={styles.avatar}>
                  <Feather name="user" size={20} color={colors.brandGreen} />
                </View>
                <View style={styles.customerCopy}>
                  <Text style={styles.customerName}>{job.customerName ?? 'Customer'}</Text>
                  <Text style={styles.customerAddress}>
                    {address.line2 ? `${address.line1}\n${address.line2}` : address.line1}
                  </Text>
                </View>
              </View>

              <View style={styles.phoneRow}>
                <View style={styles.iconCircle}>
                  <Feather name="phone" size={16} color={colors.brandGreen} />
                </View>
                <Text style={styles.phoneNumber}>{job.phoneNumber?.trim() || 'No phone number'}</Text>
                <Pressable
                  onPress={() => callCustomer(job.phoneNumber)}
                  accessibilityRole="button"
                  accessibilityLabel="Call"
                  style={styles.callPill}
                >
                  <Feather name="phone-call" size={14} color={colors.brandGreen} />
                  <Text style={styles.callPillText}>Call</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.paymentRow}>
                <View style={styles.iconCircle}>
                  <Feather name="credit-card" size={16} color={colors.brandGreen} />
                </View>
                <View style={styles.paymentCopy}>
                  <Text style={styles.paymentCaption}>Paid via</Text>
                  <Text style={styles.paymentValue}>{paymentMethodLabel(job.paymentMethod)}</Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Feather name="trash-2" size={16} color={colors.brandGreen} />
                <Text style={styles.sectionTitle}>What you're collecting</Text>
              </View>
              {(job.items ?? []).length === 0 ? (
                <Text style={styles.itemSubtitle}>No items on this job.</Text>
              ) : (
                <View style={styles.itemsStack}>
                  {(job.items ?? []).map((item) => (
                    <View key={`${item.id ?? item.type}-${item.quantity}`} style={styles.itemCard}>
                      <View style={styles.itemIcon}>
                        <Feather name="trash-2" size={22} color={colors.brandGreen} />
                      </View>
                      <View style={styles.itemCopy}>
                        <Text style={styles.itemTitle}>
                          {item.quantity} × {item.type}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {photoUrl ? (
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Feather name="image" size={16} color={colors.brandGreen} />
                  <Text style={styles.sectionTitle}>Attached photo</Text>
                </View>
                <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
              </View>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                void handleConfirmPickup();
              }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Confirm Pickup"
              style={[styles.confirmButton, busy && styles.confirmButtonDisabled]}
            >
              <Text style={styles.confirmButtonLabel}>
                {confirming ? 'Confirming…' : 'Confirm Pickup'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
};
