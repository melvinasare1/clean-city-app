import React, { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { CANCEL_REASON_CODES, CANCEL_REASON_LABELS, type CancelReasonCode } from '@platform/shared-types';
import { colors, radius, spacing, typography } from '@platform/shared-theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reasonCode: CancelReasonCode, reasonNote?: string) => void;
};

export const CancelReasonModal: React.FC<Props> = ({ visible, onClose, onSubmit }) => {
  const [otherNote, setOtherNote] = useState('');
  const [pickingOther, setPickingOther] = useState(false);

  const reset = () => {
    setOtherNote('');
    setPickingOther(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handlePick = (code: CancelReasonCode) => {
    if (code === 'OTHER') {
      setPickingOther(true);
      return;
    }
    reset();
    onSubmit(code);
  };

  const handleSubmitOther = () => {
    const note = otherNote.trim();
    if (!note) return;
    reset();
    onSubmit('OTHER', note);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Why are you cancelling?</Text>
          {!pickingOther ? (
            <View style={styles.list}>
              {CANCEL_REASON_CODES.map((code) => (
                <Pressable
                  key={code}
                  onPress={() => handlePick(code)}
                  style={styles.row}
                  accessibilityRole="button"
                  accessibilityLabel={CANCEL_REASON_LABELS[code]}
                >
                  <Text style={styles.rowText}>{CANCEL_REASON_LABELS[code]}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.otherWrap}>
              <TextInput
                value={otherNote}
                onChangeText={setOtherNote}
                placeholder="Briefly describe why you're cancelling"
                placeholderTextColor={colors.inkSecondary}
                style={styles.input}
                multiline
                autoFocus
              />
              <Pressable
                onPress={handleSubmitOther}
                disabled={!otherNote.trim()}
                style={[styles.submitButton, !otherNote.trim() && styles.submitButtonDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Submit cancellation reason"
              >
                <Text style={styles.submitButtonLabel}>Submit</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={handleClose} style={styles.closeRow}>
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
  },
  rowText: {
    color: colors.inkPrimary,
    fontSize: 15,
    fontWeight: '600' as const,
  },
  otherWrap: {
    gap: spacing.sm,
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
