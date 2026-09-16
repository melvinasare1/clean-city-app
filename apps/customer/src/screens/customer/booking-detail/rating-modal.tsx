import React, { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText, AppButton, AppTextInput } from "@/components";
import { colors } from "@platform/shared-theme";
import { submitDriverRating } from "@/services/rating-api";

type Props = {
  visible: boolean;
  bookingId: string;
  onClose: () => void;
  onSubmitted: () => void;
};

export const RatingModal: React.FC<Props> = ({ visible, bookingId, onClose, onSubmitted }) => {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStars(0);
    setComment("");
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (stars < 1) {
      setError("Please select a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitDriverRating(bookingId, stars, comment.trim() || undefined);
      reset();
      onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit rating");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={handleClose} />
        <View style={styles.sheet}>
          <AppText style={styles.title}>Rate your driver</AppText>
          <AppText style={styles.subtitle}>How was your collection?</AppText>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                key={value}
                onPress={() => setStars(value)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
              >
                <Ionicons
                  name={value <= stars ? "star" : "star-outline"}
                  size={36}
                  color={colors.brandGreen}
                />
              </Pressable>
            ))}
          </View>

          <AppTextInput
            placeholder="Add a comment (optional)"
            value={comment}
            onChangeText={setComment}
            multiline
            containerStyle={styles.commentInput}
          />

          {error ? <AppText style={styles.errorText}>{error}</AppText> : null}

          <AppButton
            title="Submit rating"
            onPress={handleSubmit}
            loading={submitting}
            buttonStyle={styles.submitButton}
          />

          <Pressable onPress={handleClose} style={styles.closeRow}>
            <AppText style={styles.closeText}>Not now</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  backdropTouch: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surfaceWhite,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.inkPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.inkSecondary,
  },
  starsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  commentInput: {
    minHeight: 70,
  },
  errorText: {
    color: "#B3261E",
    fontSize: 13,
  },
  submitButton: {
    marginTop: 4,
  },
  closeRow: {
    alignItems: "center",
    paddingVertical: 8,
  },
  closeText: {
    color: colors.inkSecondary,
    fontSize: 14,
    fontWeight: "600",
  },
});
