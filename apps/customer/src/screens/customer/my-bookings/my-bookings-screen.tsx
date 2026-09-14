import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, ResponsiveContent } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import {
  CustomerStackParamList,
  CustomerTabParamList,
} from "@/navigation/types";
import { colors } from "@platform/shared-theme";
import { styles } from "./my-bookings-screen.styles";
import {
  filterBookingsByType,
  isPastBooking,
  isUpcomingBooking,
  sortBookingsLatestFirst,
  sortBookingsSoonestFirst,
  todayIsoDate,
  type BookingsListKind,
  type BookingsTypeFilter,
} from "./my-bookings-screen.utils";
import { BookingListRow } from "./booking-list-row";
import { useBookings } from "@/contexts/bookings-context";

const PREVIEW_CAP = 2;

const FILTERS: { id: BookingsTypeFilter; label: string }[] = [
  { id: "all", label: "All Bookings" },
  { id: "subscription", label: "Subscriptions" },
  { id: "one_off", label: "One-off" },
];

type MyBookingsScreenProps = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, "MyBookings">,
  NativeStackScreenProps<CustomerStackParamList>
>;

export const MyBookingsScreen: React.FC<MyBookingsScreenProps> = ({
  navigation,
}) => {
  const { user } = useAuth();
  const { bookings, loading, error, subscribeToUserBookings, refreshBookings } =
    useBookings();
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<BookingsTypeFilter>("all");

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToUserBookings(user.id);
    return () => {
      unsubscribe?.();
    };
  }, [user?.id, subscribeToUserBookings]);

  const todayIso = todayIsoDate();

  const filtered = useMemo(
    () => filterBookingsByType(bookings, typeFilter),
    [bookings, typeFilter]
  );

  const upcoming = useMemo(
    () =>
      sortBookingsSoonestFirst(
        filtered.filter((b) => isUpcomingBooking(b, todayIso))
      ),
    [filtered, todayIso]
  );

  const past = useMemo(
    () =>
      sortBookingsLatestFirst(
        filtered.filter((b) => isPastBooking(b, todayIso))
      ),
    [filtered, todayIso]
  );

  const handlePullToRefresh = useCallback(async () => {
    setRefreshing(true);
    refreshBookings();
    setTimeout(() => setRefreshing(false), 500);
  }, [refreshBookings]);

  const openBookingDetail = useCallback(
    (bookingId: string) => {
      navigation.navigate("BookingDetail", { kind: "booking", id: bookingId });
    },
    [navigation]
  );

  const openViewAll = useCallback(
    (listKind: BookingsListKind) => {
      navigation.navigate("BookingsList", { listKind, typeFilter });
    },
    [navigation, typeFilter]
  );

  const renderSection = (
    title: string,
    listKind: BookingsListKind,
    rows: typeof upcoming,
    emptyCopy: string
  ) => {
    const preview = rows.slice(0, PREVIEW_CAP);
    const showViewAll = rows.length > PREVIEW_CAP;
    return (
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <AppText style={styles.sectionTitle}>{title}</AppText>
          {showViewAll ? (
            <TouchableOpacity
              style={styles.viewAllRow}
              onPress={() => openViewAll(listKind)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText style={styles.viewAllText}>View all</AppText>
              <Ionicons name="chevron-forward" size={14} color={colors.brandGreen} />
            </TouchableOpacity>
          ) : null}
        </View>
        {preview.length === 0 ? (
          <View style={styles.emptyCard}>
            <AppText style={styles.emptyText}>{emptyCopy}</AppText>
          </View>
        ) : (
          preview.map((booking) => (
            <BookingListRow
              key={booking.id}
              booking={booking}
              onPress={() => openBookingDetail(booking.id)}
            />
          ))
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <ScrollView
        style={styles.scrollRoot}
        contentContainerStyle={styles.scrollInner}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handlePullToRefresh}
            tintColor={colors.brandGreen}
            colors={[colors.brandGreen]}
          />
        }
      >
        <ResponsiveContent>
          <View style={styles.pageHeaderBlock}>
            <AppText style={styles.pageTitle}>My Bookings</AppText>
            <AppText style={styles.pageSubtitle}>
              View and manage your waste collection bookings
            </AppText>
          </View>

          <View style={styles.segmentTrack}>
            {FILTERS.map((tab) => {
              const active = typeFilter === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.segmentTab, active && styles.segmentTabActive]}
                  onPress={() => setTypeFilter(tab.id)}
                  activeOpacity={0.85}
                >
                  <AppText
                    style={[
                      styles.segmentTabLabel,
                      active && styles.segmentTabLabelActive,
                    ]}
                  >
                    {tab.label}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading && bookings.length === 0 ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.brandGreen} />
              <AppText style={styles.loadingText}>Loading bookings...</AppText>
            </View>
          ) : error && bookings.length === 0 ? (
            <View style={styles.errorState}>
              <AppText style={styles.errorText}>{error}</AppText>
              <TouchableOpacity style={styles.retryButton} onPress={handlePullToRefresh}>
                <AppText style={styles.retryButtonText}>Try again</AppText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {renderSection(
                "Upcoming bookings",
                "upcoming",
                upcoming,
                "No upcoming bookings"
              )}
              {renderSection(
                "Past bookings",
                "past",
                past,
                "No past bookings"
              )}
            </>
          )}
        </ResponsiveContent>
      </ScrollView>
    </SafeAreaView>
  );
};
