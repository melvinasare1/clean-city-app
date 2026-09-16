import React from "react";
import { TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components";
import { colors } from "@platform/shared-theme";
import type { Booking } from "@platform/shared-types";
import { styles } from "./my-bookings-screen.styles";
import {
  formatDate,
  getBookingListDateIso,
  getBookingListPill,
  getBookingListPillLabel,
  getBookingListTitle,
} from "./my-bookings-screen.utils";

type Props = {
  booking: Booking;
  onPress: () => void;
};

export const BookingListRow: React.FC<Props> = ({ booking, onPress }) => {
  const isSubscription = booking.type === "subscription";
  const pill = getBookingListPill(booking);
  const dateIso = getBookingListDateIso(booking);
  const dateLabel = dateIso ? formatDate(dateIso) : "—";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.cardTouchable}>
        <View style={styles.typeIconWrap}>
          <Ionicons
            name={isSubscription ? "refresh" : "calendar-outline"}
            size={20}
            color={colors.brandGreen}
          />
        </View>
        <View style={styles.cardMain}>
          <View style={styles.titleRow}>
            <AppText style={styles.cardTitle} numberOfLines={1}>
              {getBookingListTitle(booking)}
            </AppText>
            <View
              style={[
                styles.pill,
                pill === "paid" && styles.pillPaid,
                pill === "awaiting_payment" && styles.pillAwaiting,
                pill === "cancelled" && styles.pillCancelled,
                pill === "missed" && styles.pillCancelled,
              ]}
            >
              <AppText
                style={[
                  styles.pillText,
                  pill === "paid" && styles.pillTextPaid,
                  pill === "awaiting_payment" && styles.pillTextAwaiting,
                  pill === "cancelled" && styles.pillTextCancelled,
                  pill === "missed" && styles.pillTextCancelled,
                ]}
              >
                {getBookingListPillLabel(pill)}
              </AppText>
            </View>
          </View>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color={colors.inkSecondary} />
            <AppText style={styles.dateText}>{dateLabel}</AppText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.inkSecondary} />
      </View>
    </TouchableOpacity>
  );
};
