import React, { useCallback, useMemo } from "react";
import { ScrollView, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, ResponsiveContent } from "@/components";
import type { CustomerStackParamList } from "@/navigation/types";
import { colors } from "@platform/shared-theme";
import { useBookings } from "@/contexts/bookings-context";
import { BookingListRow } from "../my-bookings/booking-list-row";
import { styles } from "../my-bookings/my-bookings-screen.styles";
import {
  filterBookingsByType,
  isPastBooking,
  isUpcomingBooking,
  sortBookingsLatestFirst,
  sortBookingsSoonestFirst,
  todayIsoDate,
} from "../my-bookings/my-bookings-screen.utils";

type Props = NativeStackScreenProps<CustomerStackParamList, "BookingsList">;

export const BookingListScreen: React.FC<Props> = ({ navigation, route }) => {
  const { listKind, typeFilter } = route.params;
  const { bookings } = useBookings();
  const todayIso = todayIsoDate();

  const rows = useMemo(() => {
    const filtered = filterBookingsByType(bookings, typeFilter);
    if (listKind === "upcoming") {
      return sortBookingsSoonestFirst(
        filtered.filter((b) => isUpcomingBooking(b, todayIso))
      );
    }
    return sortBookingsLatestFirst(
      filtered.filter((b) => isPastBooking(b, todayIso))
    );
  }, [bookings, listKind, typeFilter, todayIso]);

  const title =
    listKind === "upcoming" ? "Upcoming bookings" : "Past bookings";

  const openBookingDetail = useCallback(
    (bookingId: string) => {
      navigation.navigate("BookingDetail", { kind: "booking", id: bookingId });
    },
    [navigation]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.listBody}>
        <View style={styles.listHeader}>
          <TouchableOpacity
            style={styles.listHeaderBack}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.inkPrimary} />
          </TouchableOpacity>
          <AppText style={styles.listHeaderTitle}>{title}</AppText>
          <View style={styles.listHeaderSpacer} />
        </View>
        <ScrollView
          style={styles.scrollRoot}
          contentContainerStyle={styles.listScrollInner}
          showsVerticalScrollIndicator={false}
        >
          <ResponsiveContent>
            {rows.length === 0 ? (
              <View style={styles.emptyCard}>
                <AppText style={styles.emptyText}>
                  {listKind === "upcoming"
                    ? "No upcoming bookings"
                    : "No past bookings"}
                </AppText>
              </View>
            ) : (
              rows.map((booking) => (
                <BookingListRow
                  key={booking.id}
                  booking={booking}
                  onPress={() => openBookingDetail(booking.id)}
                />
              ))
            )}
          </ResponsiveContent>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};
