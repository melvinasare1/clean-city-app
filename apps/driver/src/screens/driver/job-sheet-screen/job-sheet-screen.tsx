import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { auth, db, functions } from '@platform/shared-firebase';
import { colors } from '@platform/shared-theme';
import type { CancelReasonCode, MissedReasonCode } from '@platform/shared-types';
import { mapJobDoc, type JobOffer } from '@/hooks/useAssignedJobOffer';
import {
  formatAddressLines,
  formatWindowPill,
  paymentMethodLabel,
} from '@/lib/job-sheet';
import { loadImagePicker } from '@/lib/image-picker';
import { uploadJobPhoto } from '@/lib/upload-job-photo';
import { callCustomer, openTripOverflowMenu } from '@/lib/trip-overflow';
import { CancelReasonModal } from '@/components/driver/CancelReasonModal';
import { MissedPickupModal } from '@/components/driver/MissedPickupModal';
import type { DriverStackParamList } from '@/navigation/types';
import { styles } from './job-sheet-screen.styles';

type Props = NativeStackScreenProps<DriverStackParamList, 'JobSheet'>;

const cancelAcceptedJobFn = httpsCallable<
  { jobId: string; cancelReasonCode: CancelReasonCode; cancelReasonNote?: string },
  { ok: boolean }
>(functions, 'cancelAcceptedJob');
const confirmPickupFn = httpsCallable<{ jobId: string; photoUrl: string }, { ok: boolean }>(
  functions,
  'confirmPickup'
);
const markJobMissedFn = httpsCallable<
  { jobId: string; reason: MissedReasonCode; note?: string; photoUrl?: string },
  { ok: boolean }
>(functions, 'markJobMissed');
const logJobSheetViewedFn = httpsCallable<{ jobId: string }, { ok: boolean }>(
  functions,
  'logJobSheetViewed'
);

export const JobSheetScreen: React.FC<Props> = ({ navigation, route }) => {
  const { jobId } = route.params;
  const [job, setJob] = useState<JobOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reasonModalVisible, setReasonModalVisible] = useState(false);
  const [missedModalVisible, setMissedModalVisible] = useState(false);
  const [missing, setMissing] = useState(false);
  const [missedPhotoUri, setMissedPhotoUri] = useState<string | null>(null);
  const [missedPhotoUrl, setMissedPhotoUrl] = useState<string | null>(null);
  const [uploadingMissedPhoto, setUploadingMissedPhoto] = useState(false);
  const [pickupPhotoUri, setPickupPhotoUri] = useState<string | null>(null);
  const [pickupPhotoUrl, setPickupPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const loggedViewRef = useRef(false);

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

  useEffect(() => {
    if (loggedViewRef.current) return;
    loggedViewRef.current = true;
    logJobSheetViewedFn({ jobId }).catch(() => {});
  }, [jobId]);

  useEffect(() => {
    if (!pickupPhotoUrl && job?.pickupPhotoUrl) {
      setPickupPhotoUrl(job.pickupPhotoUrl);
    }
  }, [job?.pickupPhotoUrl, pickupPhotoUrl]);

  const busy = confirming || cancelling || missing;
  const address = formatAddressLines({
    addressLine1: job?.addressLine1,
    area: job?.area,
    location: job?.location ?? job?.address,
  });
  const photoUrl = job?.photoUrl?.trim() || null;
  const canConfirm = Boolean(pickupPhotoUrl) && !busy && !uploadingPhoto && job?.jobStatus === 'in_progress';

  const handleTakePhoto = useCallback(async () => {
    const picker = await loadImagePicker();
    if (!picker) return;

    const permission = await picker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to take a photo of the load.');
      return;
    }

    const result = await picker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    const uri = result.assets[0].uri;
    setPickupPhotoUri(uri);
    setPhotoError(null);
    setUploadingPhoto(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign in required');
      const url = await uploadJobPhoto(jobId, uid, uri);
      setPickupPhotoUrl(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not upload photo';
      setPhotoError(msg);
      Alert.alert('Upload failed', msg);
    } finally {
      setUploadingPhoto(false);
    }
  }, [jobId]);

  const handleCancel = useCallback(() => {
    setReasonModalVisible(true);
  }, []);

  const handleSubmitCancelReason = useCallback(
    (cancelReasonCode: CancelReasonCode, cancelReasonNote?: string) => {
      setReasonModalVisible(false);
      void (async () => {
        setCancelling(true);
        try {
          await cancelAcceptedJobFn({ jobId, cancelReasonCode, cancelReasonNote });
          navigation.goBack();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not cancel this job';
          Alert.alert('Error', msg);
        } finally {
          setCancelling(false);
        }
      })();
    },
    [jobId, navigation]
  );

  const handleTakeMissedPhoto = useCallback(async () => {
    const picker = await loadImagePicker();
    if (!picker) return;
    const permission = await picker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Allow camera access to attach a photo.');
      return;
    }
    const result = await picker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const uri = result.assets[0].uri;
    setMissedPhotoUri(uri);
    setUploadingMissedPhoto(true);
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign in required');
      const url = await uploadJobPhoto(jobId, uid, uri, 'missed');
      setMissedPhotoUrl(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not upload photo';
      Alert.alert('Upload failed', msg);
    } finally {
      setUploadingMissedPhoto(false);
    }
  }, [jobId]);

  const handleSubmitMissed = useCallback(
    (reason: MissedReasonCode, note?: string) => {
      setMissedModalVisible(false);
      void (async () => {
        setMissing(true);
        try {
          await markJobMissedFn({
            jobId,
            reason,
            note,
            photoUrl: missedPhotoUrl ?? undefined,
          });
          navigation.goBack();
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not record missed pickup';
          Alert.alert('Error', msg);
        } finally {
          setMissing(false);
        }
      })();
    },
    [jobId, missedPhotoUrl, navigation]
  );

  const handleConfirmPickup = useCallback(async () => {
    if (!pickupPhotoUrl) return;
    setConfirming(true);
    try {
      await confirmPickupFn({ jobId, photoUrl: pickupPhotoUrl });
      navigation.goBack();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not confirm pickup';
      Alert.alert('Error', msg);
    } finally {
      setConfirming(false);
    }
  }, [jobId, navigation, pickupPhotoUrl]);

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
              jobId,
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

            <View style={styles.card}>
              <View style={styles.sectionHeader}>
                <Feather name="camera" size={16} color={colors.brandGreen} />
                <Text style={styles.sectionTitle}>Load photo</Text>
              </View>
              {uploadingPhoto ? (
                <View style={styles.photoUploading}>
                  <ActivityIndicator color={colors.brandGreen} />
                  <Text style={styles.itemSubtitle}>Uploading photo…</Text>
                </View>
              ) : pickupPhotoUrl ? (
                <>
                  <Image
                    source={{ uri: pickupPhotoUri ?? pickupPhotoUrl }}
                    style={styles.photo}
                    resizeMode="cover"
                  />
                  <Pressable
                    onPress={() => {
                      void handleTakePhoto();
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Retake Load Photo"
                    style={styles.retakePill}
                  >
                    <Feather name="rotate-ccw" size={14} color={colors.brandGreen} />
                    <Text style={styles.retakePillText}>Retake</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => {
                    void handleTakePhoto();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Take Load Photo"
                  style={styles.takePhotoButton}
                >
                  <Feather name="camera" size={18} color={colors.brandGreen} />
                  <Text style={styles.takePhotoButtonLabel}>Take Photo</Text>
                </Pressable>
              )}
              {photoError ? <Text style={styles.photoErrorText}>{photoError}</Text> : null}
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
            {!pickupPhotoUrl ? (
              <Text style={styles.confirmHintText}>
                Take a photo of the load before confirming pickup.
              </Text>
            ) : null}
            <Pressable
              onPress={() => {
                void handleConfirmPickup();
              }}
              disabled={!canConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirm Pickup"
              style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            >
              <Text style={styles.confirmButtonLabel}>
                {confirming ? 'Confirming…' : 'Confirm Pickup'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMissedModalVisible(true)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Unable to collect"
              style={[styles.missedButton, busy && styles.confirmButtonDisabled]}
            >
              <Text style={styles.missedButtonLabel}>
                {missing ? 'Recording missed pickup…' : 'Unable to collect'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
      <CancelReasonModal
        visible={reasonModalVisible}
        onClose={() => setReasonModalVisible(false)}
        onSubmit={handleSubmitCancelReason}
      />
      <MissedPickupModal
        visible={missedModalVisible}
        submitting={missing}
        onClose={() => setMissedModalVisible(false)}
        onTakePhoto={() => {
          void handleTakeMissedPhoto();
        }}
        photoUri={missedPhotoUri}
        uploadingPhoto={uploadingMissedPhoto}
        onSubmit={handleSubmitMissed}
      />
    </SafeAreaView>
  );
};
