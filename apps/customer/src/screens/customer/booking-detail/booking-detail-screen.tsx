import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, ResponsiveContent } from "@/components";
import { useAuth } from "@/hooks/useAuth";
import type { CustomerStackParamList } from "@/navigation/types";
import {
  getUnifiedStatusForBooking,
  getUnifiedStatusForSubscription,
  isInactiveDetailStatus,
} from "@/lib/booking-display-status";
import { pickupAddressText } from "@/lib/profile-location";
import { colors } from "@platform/shared-theme";
import { initiatePaymentForBooking, verifyBookingPayment } from "@/services/booking-service";
import { getSubscriptionPaymentUrl, verifySubscriptionPayment } from "@/services/payments";
import { useBookings } from "@/contexts/bookings-context";
import { useSubscriptions } from "@/contexts/subscriptions-context";
import type { Subscription } from "@/types/subscription";
import {
  getBookingListPill,
  getBookingListPillLabel,
  getBookingListTitle,
  getSubscriptionPaystackReference,
  type BookingListPillKind,
} from "../my-bookings/my-bookings-screen.utils";
import { styles } from "./booking-detail-screen.styles";
import {
  formatDetailCollectionDate,
  formatGhsAmount,
  getLinkedBookingForSubscription,
  getNextPickupIsoForBooking,
  getNextPickupIsoForSubscription,
  getSubscriptionBookingTypeCardLabel,
} from "./booking-detail-screen.utils";

type Props = NativeStackScreenProps<CustomerStackParamList, "BookingDetail">;

function subscriptionPill(sub: Subscription): BookingListPillKind {
  if (sub.status === "cancelled" || sub.status === "paused") return "cancelled";
  if (sub.status === "active" || sub.payment?.status === "paid") return "paid";
  return "awaiting_payment";
}

export const BookingDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { kind, id } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { bookings } = useBookings();
  const { subscriptions, refreshSubscriptions } = useSubscriptions();

  const [menuOpen, setMenuOpen] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const subscription = kind === "subscription" ? subscriptions.find((s) => s.id === id) : undefined;
  const booking = kind === "booking" ? bookings.find((b) => b.id === id) : undefined;
  const linkedForSub = subscription
    ? getLinkedBookingForSubscription(subscription, bookings)
    : undefined;

  const unifiedStatus =
    kind === "subscription" && subscription
      ? getUnifiedStatusForSubscription(subscription)
      : kind === "booking" && booking
        ? getUnifiedStatusForBooking(booking)
        : ("cancelled" as const);

  const pill: BookingListPillKind =
    kind === "subscription" && subscription
      ? subscriptionPill(subscription)
      : booking
        ? getBookingListPill(booking)
        : "cancelled";

  const inactive = isInactiveDetailStatus(unifiedStatus);
  const isSubscriptionView =
    kind === "subscription" || booking?.type === "subscription";

  const title =
    kind === "subscription" && subscription
      ? getSubscriptionBookingTypeCardLabel(subscription)
      : booking
        ? getBookingListTitle(booking)
        : "";

  const nextPickupIso = subscription
    ? getNextPickupIsoForSubscription(subscription, bookings)
    : booking
      ? getNextPickupIsoForBooking(booking)
      : null;

  const collectionLabel = isSubscriptionView ? "Next collection" : "Collection date";
  const collectionValue =
    nextPickupIso && !inactive
      ? formatDetailCollectionDate(nextPickupIso)
      : unifiedStatus === "awaiting_payment" || unifiedStatus === "payment_required"
        ? "Pending payment"
        : "—";

  const items =
    booking?.items ??
    linkedForSub?.items ??
    [];

  const address =
    (booking?.location ?? linkedForSub?.location ?? "").trim() ||
    pickupAddressText(user ?? {});

  const amountValue =
    subscription?.amount != null
      ? formatGhsAmount(subscription.amount)
      : booking
        ? formatGhsAmount(booking.totalPrice)
        : null;

  const showPayActions = pill === "awaiting_payment";
  const showHelpCta = !showPayActions;

  const busy = processingPayment || verifying;

  const handleGetHelp = useCallback(() => {
    setMenuOpen(false);
    navigation.navigate("CustomerTabs", { screen: "CustomerHelp" });
  }, [navigation]);

  const handleGetInvoice = useCallback(() => {
    setMenuOpen(false);
    Alert.alert(
      "Invoice not available yet",
      "Receipt and invoice download is not in the app yet. Use Get help if you need a copy of this booking."
    );
  }, []);

  const handleChangeAddress = useCallback(() => {
    navigation.navigate("SetPickupLocation", {
      initialAddress: address || undefined,
      initialLocation: user?.location ?? null,
      saveToProfile: true,
    });
  }, [address, navigation, user?.location]);

  const handlePayNow = useCallback(async () => {
    if (!user?.email) {
      Alert.alert(
        "Email required",
        "We need your email address to process the payment. Please update your profile."
      );
      return;
    }
    try {
      setProcessingPayment(true);
      if (kind === "subscription" && subscription) {
        const { authorizationUrl } = await getSubscriptionPaymentUrl({
          subscriptionId: subscription.id,
          reference: getSubscriptionPaystackReference(subscription),
        });
        await Linking.openURL(authorizationUrl);
        Alert.alert(
          "Complete payment",
          "Please complete your subscription payment in the opened page. Status will update automatically once payment is confirmed."
        );
        return;
      }
      if (!booking) return;
      const subscriptionIdForBooking =
        booking.type === "subscription" && booking.subscriptionId
          ? String(booking.subscriptionId).trim()
          : "";
      if (subscriptionIdForBooking) {
        const { authorizationUrl } = await getSubscriptionPaymentUrl({
          subscriptionId: subscriptionIdForBooking,
          reference: booking.payment?.reference,
        });
        await Linking.openURL(authorizationUrl);
        Alert.alert(
          "Complete payment",
          "Please complete your subscription payment in the opened page. Status will update automatically once payment is confirmed."
        );
        return;
      }
      if (booking.payment.authorizationUrl) {
        await Linking.openURL(booking.payment.authorizationUrl);
      } else {
        const { authorizationUrl } = await initiatePaymentForBooking(booking.id);
        await Linking.openURL(authorizationUrl);
      }
      Alert.alert(
        "Complete payment",
        "Please complete your payment in the opened page. Your booking will update automatically once payment is confirmed via webhook."
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not start payment. Please try again.";
      Alert.alert("Payment error", message);
    } finally {
      setProcessingPayment(false);
    }
  }, [booking, kind, subscription, user?.email]);

  const handleVerifyPayment = useCallback(async () => {
    try {
      setVerifying(true);
      if (kind === "subscription" && subscription) {
        const result = await verifySubscriptionPayment(
          subscription.id,
          getSubscriptionPaystackReference(subscription) || null
        );
        refreshSubscriptions();
        Alert.alert(
          result.paid ? "Payment confirmed" : "Payment not confirmed",
          result.paid
            ? "Your subscription payment has been confirmed. Status will update shortly."
            : "Payment has not been confirmed yet. Complete payment in the browser and tap Verify again, or wait for the page to update automatically."
        );
        return;
      }
      if (!booking) return;
      const isAlreadyPaid = await verifyBookingPayment(booking.id, true);
      Alert.alert(
        isAlreadyPaid ? "Payment Confirmed ✅" : "Payment Not Found",
        isAlreadyPaid
          ? "This booking has been paid for. Your booking list will update automatically."
          : "Payment has not been confirmed yet. This may take a few moments after completing payment. Your booking will update automatically once payment is confirmed."
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not verify payment. Please try again.";
      Alert.alert("Verification failed", message);
    } finally {
      setVerifying(false);
    }
  }, [booking, kind, refreshSubscriptions, subscription]);

  if (kind === "subscription" && !subscription) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.notFound}>
          <AppText style={styles.notFoundText}>This subscription could not be found.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (kind === "booking" && !booking) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.notFound}>
          <AppText style={styles.notFoundText}>This booking could not be found.</AppText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={colors.inkPrimary} />
        </TouchableOpacity>
        <AppText style={styles.headerTitle}>Booking Details</AppText>
        <TouchableOpacity
          style={styles.headerSide}
          onPress={() => setMenuOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="More actions"
        >
          <View style={styles.overflowBtn}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.inkSecondary} />
          </View>
        </TouchableOpacity>
      </View>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <Pressable
            style={[styles.menuCard, { top: insets.top + 44 }]}
            onPress={() => undefined}
          >
            <TouchableOpacity style={styles.menuItem} onPress={handleGetInvoice}>
              <Ionicons name="download-outline" size={18} color={colors.inkPrimary} />
              <AppText style={styles.menuItemText}>Get invoice/receipt</AppText>
            </TouchableOpacity>
            <View style={styles.menuDivider} />
            <TouchableOpacity style={styles.menuItem} onPress={handleGetHelp}>
              <Ionicons name="help-circle-outline" size={18} color={colors.inkPrimary} />
              <AppText style={styles.menuItemText}>Get help</AppText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContent>
          <View style={styles.typeCard}>
            <View style={styles.typeIconWrap}>
              <Ionicons name="calendar-outline" size={22} color={colors.brandGreen} />
            </View>
            <View style={styles.typeMain}>
              <AppText style={styles.typeTitle}>{title}</AppText>
              <View
                style={[
                  styles.pill,
                  pill === "paid" && styles.pillPaid,
                  pill === "awaiting_payment" && styles.pillAwaiting,
                  pill === "cancelled" && styles.pillCancelled,
                ]}
              >
                <AppText
                  style={[
                    styles.pillText,
                    pill === "paid" && styles.pillTextPaid,
                    pill === "awaiting_payment" && styles.pillTextAwaiting,
                    pill === "cancelled" && styles.pillTextCancelled,
                  ]}
                >
                  {getBookingListPillLabel(pill)}
                </AppText>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.collectionRow}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="calendar-outline" size={18} color={colors.inkSecondary} />
              </View>
              <View style={styles.rowCopy}>
                <AppText style={styles.rowLabel}>{collectionLabel}</AppText>
                <AppText
                  style={nextPickupIso && !inactive ? styles.rowValue : styles.rowValueMuted}
                >
                  {collectionValue}
                </AppText>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.addressHeader}>
              <View style={styles.rowIconWrap}>
                <Ionicons name="location-outline" size={18} color={colors.inkSecondary} />
              </View>
              <View style={styles.rowCopy}>
                <AppText style={styles.rowLabel}>Pickup address</AppText>
                <AppText style={styles.addressValue}>
                  {address || "No pickup address on file"}
                </AppText>
              </View>
              {!inactive ? (
                <TouchableOpacity
                  style={styles.changeLink}
                  onPress={handleChangeAddress}
                  accessibilityRole="button"
                  accessibilityLabel="Change pickup address"
                >
                  <AppText style={styles.changeLinkText}>Change</AppText>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {items.length > 0 ? (
            <View style={styles.infoCard}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="trash-outline" size={18} color={colors.inkPrimary} />
                <AppText style={styles.cardTitle}>Items in this booking</AppText>
              </View>
              {items.map((item, index) => (
                <View key={`${item.type}-${index}`} style={styles.itemRow}>
                  <AppText style={styles.itemName}>{item.type}</AppText>
                  <AppText style={styles.itemQty}>{item.quantity}</AppText>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="card-outline" size={18} color={colors.inkPrimary} />
              <AppText style={styles.cardTitle}>Payment information</AppText>
            </View>
            <View style={styles.paymentLine}>
              <AppText style={styles.paymentLineLabel}>Payment method</AppText>
              <AppText style={styles.paymentLineValue}>Mobile Money</AppText>
            </View>
            {amountValue ? (
              <View style={styles.paymentLine}>
                <AppText style={styles.paymentLineLabel}>Amount</AppText>
                <AppText style={styles.paymentLineValue}>{amountValue}</AppText>
              </View>
            ) : null}
          </View>

          <View style={styles.actionsBlock}>
            {showPayActions ? (
              <>
                <TouchableOpacity
                  style={[styles.ctaButton, styles.ctaPrimary]}
                  onPress={handlePayNow}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Pay now"
                >
                  {processingPayment ? (
                    <ActivityIndicator color={colors.surfaceWhite} />
                  ) : (
                    <>
                      <Ionicons name="card-outline" size={18} color={colors.surfaceWhite} />
                      <AppText style={styles.ctaPrimaryText}>Pay Now</AppText>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ctaButton, styles.ctaSecondary]}
                  onPress={handleVerifyPayment}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel="Verify payment"
                >
                  {verifying ? (
                    <ActivityIndicator color={colors.brandGreen} />
                  ) : (
                    <>
                      <Ionicons name="time-outline" size={18} color={colors.brandGreen} />
                      <AppText style={styles.ctaSecondaryText}>Verify Payment</AppText>
                    </>
                  )}
                </TouchableOpacity>
              </>
            ) : null}

            {showHelpCta ? (
              <TouchableOpacity
                style={[styles.ctaButton, styles.ctaSoft]}
                onPress={handleGetHelp}
                accessibilityRole="button"
                accessibilityLabel="Get help"
              >
                <Ionicons name="headset-outline" size={18} color={colors.brandGreen} />
                <AppText style={styles.ctaSecondaryText}>Get Help</AppText>
              </TouchableOpacity>
            ) : null}
          </View>
        </ResponsiveContent>
      </ScrollView>
    </SafeAreaView>
  );
};
