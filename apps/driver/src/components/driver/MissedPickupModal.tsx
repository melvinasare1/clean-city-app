import React, { useState } from 'react';
import { Image, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  MISSED_REASON_CODES,
  MISSED_REASON_LABELS,
  type MissedReasonCode,
} from '@platform/shared-types';
import { colors, radius, spacing, typography } from '@platform/shared-theme';

type Props = {
  visible: boolean;
  submitting?: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  photoUri?: string | null;
  uploadingPhoto?: boolean;
  onSubmit: (reason: MissedReasonCode, note?: string) => void;
};

export const MissedPickupModal: React.FC<Props> = ({
  visible,
  submitting,
  onClose,
  onTakePhoto,
  photoUri,
  uploadingPhoto,
  onSubmit,
}) => {
  const [reason, setReason] = useState<MissedReasonCode | null>(null);
  const [otherNote, setOtherNote] = useState('');

  const reset = () => {
    setReason(null);
    setOtherNote('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const canSubmit =
    Boolean(reason) &&
    (reason !== 'OTHER' || Boolean(otherNote.trim())) &&
    !submitting &&
    !uploadingPhoto;

  const handleSubmit = () => {
    if (!reason || !canSubmit) return;
    const note = reason === 'OTHER' ? otherNote.trim() : undefined;
    onSubmit(reason, note);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Unable to collect</Text>
          <Text style={styles.subtitle}>Select a reason. This marks the pickup as missed.</Text>
          <View style={styles.list}>
            {MISSED_REASON_CODES.map((code) => {
              const selected = reason === code;
              return (
                <Pressable
                  key={code}
                  onPress={() => setReason(code)}
                  style={[styles.row, selected && styles.rowSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={MISSED_REASON_LABELS[code]}
                >
                  <Text style={styles.rowText}>{MISSED_REASON_LABELS[code]}</Text>
                </Pressable>
              );
            })}
          </View>
          {reason === 'OTHER' ? (
            <TextInput
              value={otherNote}
              onChangeText={setOtherNote}
              placeholder="Briefly describe why you could not collect"
              placeholderTextColor={colors.inkSecondary}
              style={styles.input}
              multiline
              maxLength={280}
            />
          ) : null}
          <Pressable
            onPress={onTakePhoto}
            disabled={uploadingPhoto || submitting}
            style={styles.photoButton}
            accessibilityRole="button"
            accessibilityLabel="Attach photo"
          >
            <Feather name="camera" size={16} color={colors.brandGreen} />
            <Text style={styles.photoButtonLabel}>
              {uploadingPhoto ? 'Uploading photo…' : photoUri ? 'Retake photo' : 'Attach photo (optional)'}
            </Text>
          </Pressable>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
          ) : null}
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Submit missed pickup"
          >
            <Text style={styles.submitButtonLabel}>
              {submitting ? 'Submitting…' : 'Mark as missed'}
            </Text>
          </Pressable>
          <Pressable onPress={handleClose} style={styles.closeRow} disabled={submitting}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = {
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' as const,
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surfaceWhite,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    ...typography.headline,
    fontSize: 17,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  row: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.brandGreenSoft,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowSelected: {
    borderColor: colors.brandGreen,
  },
  rowText: {
    color: colors.inkPrimary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  input: {
    minHeight: 80,
    borderRadius: radius.card,
    backgroundColor: colors.brandGreenSoft,
    padding: spacing.md,
    color: colors.inkPrimary,
    fontSize: 15,
    textAlignVertical: 'top' as const,
  },
  photoButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  photoButtonLabel: {
    color: colors.brandGreen,
    fontSize: 15,
    fontWeight: '700' as const,
  },
  photo: {
    width: '100%' as const,
    height: 140,
    borderRadius: radius.card,
    backgroundColor: colors.brandGreenSoft,
  },
  submitButton: {
    borderRadius: radius.card,
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: colors.brandGreen,
  },
  submitButtonDisabled: {
    opacity: 0.55,
  },
  submitButtonLabel: {
    ...typography.button,
    color: colors.surfaceWhite,
  },
  closeRow: {
    alignItems: 'center' as const,
    paddingVertical: spacing.sm,
  },
  closeText: {
    color: colors.inkSecondary,
    fontSize: 14,
    fontWeight: '600' as const,
  },
};
