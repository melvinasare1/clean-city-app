import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CommonActions } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText } from "@/components";
import { BUSINESS_WHATSAPP_NUMBER, buildWhatsAppSupportUrl } from "@/config/support";
import { useAuth } from "@/hooks/useAuth";
import type { CustomerStackParamList } from "@/navigation/types";
import {
  getUnifiedStatusForBooking,
  getUnifiedStatusForSubscription,
  getUnifiedStatusLabel,
  isInactiveDetailStatus,
  type UnifiedDetailStatus,
} from "@/lib/booking-display-status";
import { COLORS } from "@/lib/constants";
import { deleteBooking, initiatePaymentForBooking, verifyBookingPayment } from "@/services/booking-service";
import {
  cancelSubscription,
  getSubscriptionPaymentUrl,
  verifySubscriptionPayment,
} from "@/services/payments";
import { useBookings } from "@/contexts/bookings-context";
import { useSubscriptions } from "@/contexts/subscriptions-context";
import type { Booking } from "@/types/booking";
import type { Subscription } from "@/types/subscription";
import { getSubscriptionPaystackReference } from "../my-bookings/my-bookings-screen.utils";
import { styles, headerDotsStyle } from "./booking-detail-screen.styles";
import {
  formatCollectionBannerDate,
  formatDate,
  formatFirestoreTimestamp,
  formatPrice,
  formatShortMonthDay,
  getArrivingInLabelForPickup,
  getCardBookingTypeLabel,
  getCollectionDayEveryLabel,
  getCollectionDayEveryLabelForBooking,
  getHonourUntilDescription,
  getLinkedBookingForSubscription,
  getNextPickupIsoForBooking,
  getNextPickupIsoForSubscription,
  getServiceSummaryCollectionLabel,
  getServiceSummaryLabelForBooking,
  getSubscriptionBookingTypeCardLabel,
  subscriptionPaymentDiscountLines,
  getBinSummary,
} from "./booking-detail-screen.utils";

function getDetailStatusPillBackground(status: UnifiedDetailStatus): string {
  switch (status) {
    case "active":
      return "#2E7D32";
    case "awaiting_payment":
      return "#F57C00";
    case "payment_required":
      return "#FF7043";
    case "cancelled":
    case "completed":
    default:
      return "#757575";
  }
}

type Props = NativeStackScreenProps<CustomerStackParamList, "BookingDetail">;

export const BookingDetailScreen: React.FC<Props> = ({ navigation, route }) => {
  const { kind, id } = route.params;
  const { user } = useAuth();
  const { bookings, removeBookingOptimistically } = useBookings();
  const { subscriptions, refreshSubscriptions } = useSubscriptions();

  const [processingPayment, setProcessingPayment] = useState(false);
  const [verifyingBooking, setVerifyingBooking] = useState(false);
  const [deletingBooking, setDeletingBooking] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState(false);
  const [completingSubscriptionPayment, setCompletingSubscriptionPayment] = useState(false);
  const [verifyingSubscriptionPayment, setVerifyingSubscriptionPayment] = useState(false);

  const subscription = useMemo(
    () => (kind === "subscription" ? subscriptions.find((s) => s.id === id) : undefined),
    [kind, id, subscriptions]
  );

  const booking = useMemo(
    () => (kind === "booking" ? bookings.find((b) => b.id === id) : undefined),
    [kind, id, bookings]
  );

  const unifiedStatus = useMemo(() => {
    if (kind === "subscription" && subscription) {
      return getUnifiedStatusForSubscription(subscription);
    }
    if (kind === "booking" && booking) {
      return getUnifiedStatusForBooking(booking);
    }
    return "cancelled" as const;
  }, [kind, subscription, booking]);

  const inactive = isInactiveDetailStatus(unifiedStatus);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: "Booking Details",
      headerTitleAlign: "center",
      headerRight: () => (
        <TouchableOpacity
          style={headerDotsStyle.btn}
          onPress={() => {
            Linking.openURL(`https://wa.me/${BUSINESS_WHATSAPP_NUMBER}`).catch((err) =>
              console.warn("Failed to open WhatsApp", err)
            );
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <View style={headerDotsStyle.row}>
            <View style={headerDotsStyle.dot} />
            <View style={headerDotsStyle.dot} />
            <View style={headerDotsStyle.dot} />
          </View>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const handleContactSupport = useCallback(() => {
    const message =
      kind === "subscription"
        ? `Hi, I need help with my subscription. Subscription ID: ${id}`
        : `Hi, I need help with my booking. Booking ID: ${id}`;
    const url = buildWhatsAppSupportUrl(BUSINESS_WHATSAPP_NUMBER, message);
    Linking.openURL(url).catch((err) => console.warn("Failed to open WhatsApp", err));
  }, [kind, id]);

  const handleAddPickupDay = useCallback(() => {
    navigation.dispatch(
      CommonActions.navigate({
        name: "CustomerTabs",
        params: { screen: "NewBooking" },
      })
    );
  }, [navigation]);

  const handleContinuePaymentBooking = useCallback(
    async (b: Booking) => {
      if (!user?.email) {
        Alert.alert(
          "Email required",
          "We need your email address to process the payment. Please update your profile."
        );
        return;
      }
      try {
        setProcessingPayment(true);
        const subscriptionIdForBooking =
          b.type === "subscription" && b.subscriptionId != null && b.subscriptionId !== ""
            ? String(b.subscriptionId).trim()
            : "";
        if (subscriptionIdForBooking) {
          const { authorizationUrl } = await getSubscriptionPaymentUrl({
            subscriptionId: subscriptionIdForBooking,
            reference: b.payment?.reference,
          });
          await Linking.openURL(authorizationUrl);
          Alert.alert(
            "Complete payment",
            "Please complete your subscription payment in the opened page. Status will update automatically once payment is confirmed."
          );
          return;
        }
        if (b.payment.authorizationUrl) {
          await Linking.openURL(b.payment.authorizationUrl);
          Alert.alert(
            "Complete payment",
            "Please complete your payment in the opened page. Your booking will update automatically once payment is confirmed via webhook."
          );
        } else {
          const bookingId = b?.id != null ? String(b.id).trim() : "";
          if (!bookingId) {
            Alert.alert("Error", "Booking ID is missing. Please refresh and try again.");
            return;
          }
          const { authorizationUrl } = await initiatePaymentForBooking(bookingId);
          await Linking.openURL(authorizationUrl);
          Alert.alert(
            "Complete payment",
            "Please complete your payment in the opened page. Your booking will update automatically once payment is confirmed via webhook.",
            [{ text: "OK" }]
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not start payment. Please try again.";
        Alert.alert("Payment error", message);
      } finally {
        setProcessingPayment(false);
      }
    },
    [user?.email]
  );

  const handleManualVerifyBooking = useCallback(async (b: Booking) => {
    const bookingId = b?.id != null ? String(b.id).trim() : "";
    if (!bookingId) {
      Alert.alert("Error", "Booking ID is missing. Please refresh and try again.");
      return;
    }
    try {
      setVerifyingBooking(true);
      const isAlreadyPaid = await verifyBookingPayment(bookingId, true);
      if (isAlreadyPaid) {
        Alert.alert(
          "Payment Confirmed ✅",
          "This booking has been paid for. Your booking list will update automatically.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Payment Not Found",
          "Payment has not been confirmed yet. This may take a few moments after completing payment. Your booking will update automatically once payment is confirmed.",
          [{ text: "OK" }]
        );
      }
    } catch (verifyError: unknown) {
      const msg = verifyError instanceof Error ? verifyError.message : "Could not verify payment.";
      Alert.alert("Verification Error", msg, [{ text: "OK" }]);
    } finally {
      setVerifyingBooking(false);
    }
  }, []);

  const handleDeleteBooking = useCallback(
    (b: Booking) => {
      Alert.alert(
        "Cancel booking?",
        "This will remove this booking permanently. You can create a new one anytime.",
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel booking",
            style: "destructive",
            onPress: async () => {
              try {
                setDeletingBooking(true);
                await deleteBooking(b.id);
                removeBookingOptimistically(b.id);
                navigation.goBack();
              } catch (deleteError: unknown) {
                const message =
                  deleteError instanceof Error ? deleteError.message : "Could not cancel booking.";
                Alert.alert("Error", message, [{ text: "OK" }]);
              } finally {
                setDeletingBooking(false);
              }
            },
          },
        ]
      );
    },
    [navigation, removeBookingOptimistically]
  );

  const handleCancelSubscription = useCallback(
    (sub: Subscription) => {
      const subscriptionId = sub?.id != null ? String(sub.id).trim() : "";
      if (!subscriptionId) {
        Alert.alert("Error", "Subscription ID is missing. Please refresh and try again.");
        return;
      }
      const honourUntil = getHonourUntilDescription(sub, bookings);
      const isPending = sub.status === "pending";
      Alert.alert(
        isPending ? "Cancel pending subscription?" : "Cancel subscription?",
        isPending
          ? "This will cancel your pending subscription. You can start a new one anytime."
          : `Are you sure you want to cancel? Your remaining pickups will be honoured until ${honourUntil}.`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Cancel Subscription",
            style: "destructive",
            onPress: async () => {
              try {
                setCancellingSubscription(true);
                await cancelSubscription({
                  subscriptionId,
                  reference: getSubscriptionPaystackReference(sub),
                });
                refreshSubscriptions();
                Alert.alert(
                  "Subscription cancelled",
                  "Your subscription has been cancelled. Status will update shortly.",
                  [{ text: "OK" }]
                );
                navigation.goBack();
              } catch (err: unknown) {
                const message =
                  err instanceof Error ? err.message : "Could not cancel subscription. Please try again.";
                Alert.alert("Error", message);
              } finally {
                setCancellingSubscription(false);
              }
            },
          },
        ]
      );
    },
    [bookings, navigation, refreshSubscriptions]
  );

  const handleVerifySubscriptionPayment = useCallback(
    async (sub: Subscription) => {
      const subscriptionId = sub?.id != null ? String(sub.id).trim() : "";
      if (!subscriptionId) {
        Alert.alert("Error", "Subscription ID is missing. Please refresh and try again.");
        return;
      }
      try {
        setVerifyingSubscriptionPayment(true);
        const result = await verifySubscriptionPayment(
          subscriptionId,
          getSubscriptionPaystackReference(sub) || null
        );
        refreshSubscriptions();
        if (result.paid) {
          Alert.alert(
            "Payment confirmed",
            "Your subscription payment has been confirmed. Status will update shortly.",
            [{ text: "OK" }]
          );
        } else {
          Alert.alert(
            "Payment not confirmed",
            "Payment has not been confirmed yet. Complete payment in the browser and tap Verify again, or wait for the page to update automatically.",
            [{ text: "OK" }]
          );
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not verify payment. Please try again.";
        Alert.alert("Verification failed", message);
      } finally {
        setVerifyingSubscriptionPayment(false);
      }
    },
    [refreshSubscriptions]
  );

  const handleCompleteSubscriptionPayment = useCallback(async (sub: Subscription) => {
    const subscriptionId = sub?.id != null ? String(sub.id).trim() : "";
    if (!subscriptionId) {
      Alert.alert("Error", "Subscription ID is missing. Please refresh and try again.");
      return;
    }
    try {
      setCompletingSubscriptionPayment(true);
      const { authorizationUrl } = await getSubscriptionPaymentUrl({
        subscriptionId,
        reference: getSubscriptionPaystackReference(sub),
      });
      await Linking.openURL(authorizationUrl);
      Alert.alert(
        "Complete payment",
        "Please complete your subscription payment in the opened page. Status will update automatically once payment is confirmed."
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not start payment. Please try again.";
      Alert.alert("Payment error", message);
    } finally {
      setCompletingSubscriptionPayment(false);
    }
  }, []);

  if (kind === "subscription" && !subscription) {
    return (
      <View style={styles.notFound}>
        <AppText style={styles.notFoundText}>This subscription could not be found.</AppText>
      </View>
    );
  }

  if (kind === "booking" && !booking) {
    return (
      <View style={styles.notFound}>
        <AppText style={styles.notFoundText}>This booking could not be found.</AppText>
      </View>
    );
  }

  const s = kind === "subscription" ? subscription : null;
  const b = kind === "booking" ? booking : null;

  const nextPickupIso = s
    ? getNextPickupIsoForSubscription(s, bookings)
    : getNextPickupIsoForBooking(b!);

  const hasConfirmedPickupDate = Boolean(nextPickupIso) && !inactive;
  const upcomingBannerText = hasConfirmedPickupDate
    ? formatDate(nextPickupIso!)
    : unifiedStatus === "awaiting_payment" || unifiedStatus === "payment_required"
      ? "Pending payment"
      : "No upcoming pickups";

  const linkedForSub = s ? getLinkedBookingForSubscription(s, bookings) : undefined;
  const binSummary = s
    ? linkedForSub
      ? getBinSummary(linkedForSub.items)
      : "—"
    : getBinSummary(b!.items);

  const serviceLabel = s ? getServiceSummaryCollectionLabel(s) : getServiceSummaryLabelForBooking(b!);

  const collectionDayLabel = s
    ? getCollectionDayEveryLabel(s)
    : getCollectionDayEveryLabelForBooking(b!);

  const originalDiscountLines = s ? subscriptionPaymentDiscountLines(s) : null;

  const amountValue = s
    ? s.amount != null
      ? formatPrice(s.amount)
      : null
    : formatPrice(b!.totalPrice);

  const lastPayment = s
    ? formatFirestoreTimestamp(s.lastChargeDate ?? undefined)
    : formatFirestoreTimestamp(b!.payment.paidAt ?? undefined);

  const showBinsRow =
    !(s && !linkedForSub) &&
    binSummary !== "—" &&
    binSummary !== "No bins recorded";
  const showCollectionDayRow = collectionDayLabel !== "—";
  const showLastPaymentRow = Boolean(lastPayment);
  const showAmountRow = Boolean(amountValue && amountValue !== "—");
  const showAmountAsPaid =
    (s != null && s.payment?.status === "paid") || (b != null && b.payment.status === "paid");

  const paymentCardBorderColor = showAmountAsPaid ? "#2E7D32" : "#C62828";
  const pageHeadingTitle =
    kind === "subscription" && subscription
      ? getSubscriptionBookingTypeCardLabel(subscription)
      : kind === "booking" && booking
        ? getCardBookingTypeLabel(booking)
        : "";
  const cancelDate =
    s?.status === "cancelled"
      ? formatFirestoreTimestamp(s.updatedAt ?? undefined)
      : null;

  const showSubscriptionActions = kind === "subscription" && unifiedStatus === "active";
  const showSubscriptionPaymentActions =
    kind === "subscription" &&
    (unifiedStatus === "awaiting_payment" || unifiedStatus === "payment_required");
  const showBookingPaymentActions =
    kind === "booking" &&
    (unifiedStatus === "awaiting_payment" || unifiedStatus === "payment_required");
  const showCancelBooking =
    kind === "booking" && unifiedStatus === "active" && b!.status === "pending";

  const showPaymentAlert =
    unifiedStatus === "payment_required" || unifiedStatus === "awaiting_payment";

  const paymentAlertTitle =
    unifiedStatus === "payment_required"
      ? "Payment Required"
      : unifiedStatus === "awaiting_payment"
        ? "Awaiting Payment"
        : "";

  const arrivingLabel =
    hasConfirmedPickupDate && nextPickupIso
      ? getArrivingInLabelForPickup(nextPickupIso)
      : null;

  const upcomingBannerMainLine =
    hasConfirmedPickupDate && nextPickupIso
      ? formatCollectionBannerDate(nextPickupIso)
      : upcomingBannerText;

  const dueByShort = s?.nextChargeDate
    ? formatShortMonthDay(s.nextChargeDate)
    : b?.date
      ? formatShortMonthDay(new Date(`${b.date}T12:00:00`))
      : null;

  const dueMetaLine =
    showAmountAsPaid
      ? "Paid"
      : s && dueByShort
      ? `Due by ${dueByShort}`
      : b && dueByShort
        ? `Pickup on ${dueByShort}`
        : null;

  const savingsFormatted =
    originalDiscountLines != null
      ? `- ${formatPrice(originalDiscountLines.discountAmount)}`
      : "";

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, inactive && styles.scrollMuted]}
    >
      {showPaymentAlert ? (
        <View style={styles.paymentAlert}>
          <View style={styles.paymentAlertIconOuter}>
            <AppText style={styles.paymentAlertIconText}>!</AppText>
          </View>
          <View style={styles.paymentAlertTextCol}>
            <AppText style={styles.paymentAlertTitle}>{paymentAlertTitle}</AppText>
            <AppText style={styles.paymentAlertBody}>
              Please complete your payment to secure the next collection window.
            </AppText>
          </View>
        </View>
      ) : null}

      {!showPaymentAlert && pageHeadingTitle ? (
        <AppText style={styles.pageTitle}>{pageHeadingTitle}</AppText>
      ) : null}

      {!showPaymentAlert ? (
        <View
          style={[
            styles.statusPillRow,
            { backgroundColor: getDetailStatusPillBackground(unifiedStatus) },
          ]}
        >
          <AppText style={styles.statusPillText}>
            {getUnifiedStatusLabel(unifiedStatus).toUpperCase()}
          </AppText>
        </View>
      ) : null}

      <View style={styles.upcomingBanner}>
        <View style={styles.upcomingBannerWatermark} pointerEvents="none">
          {Array.from({ length: 20 }).map((_, i) => (
            <AppText key={i} style={styles.upcomingBannerWatermarkChar}>
              ♻︎
            </AppText>
          ))}
        </View>
        <View style={styles.upcomingBannerRow}>
          <View style={styles.upcomingBannerIconBox}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.white} />
          </View>
          <View style={styles.upcomingBannerTextCol}>
            <AppText style={styles.upcomingBannerLabelCaps}>NEXT COLLECTION</AppText>
            <AppText
              style={
                hasConfirmedPickupDate ? styles.upcomingBannerDate : styles.upcomingBannerDateMuted
              }
            >
              {upcomingBannerMainLine}
            </AppText>
            {arrivingLabel ? (
              <View style={styles.upcomingArrivingBadge}>
                <AppText style={styles.upcomingArrivingBadgeText}>{arrivingLabel}</AppText>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.detailCardsStack}>
        <View style={styles.detailMiniCard}>
          <View style={styles.detailMiniIconBox}>
            <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={styles.detailMiniTextCol}>
            <AppText style={styles.detailMiniLabel}>Frequency</AppText>
            <AppText style={styles.detailMiniValue}>{serviceLabel}</AppText>
          </View>
        </View>
        {showBinsRow ? (
          <View style={styles.detailMiniCard}>
            <View style={styles.detailMiniIconBox}>
              <Ionicons name="trash-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.detailMiniTextCol}>
              <AppText style={styles.detailMiniLabel}>Capacity</AppText>
              <AppText style={styles.detailMiniValue}>{binSummary}</AppText>
            </View>
          </View>
        ) : null}
        {showCollectionDayRow ? (
          <View style={styles.detailMiniCard}>
            <View style={styles.detailMiniIconBox}>
              <Ionicons name="time-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.detailMiniTextCol}>
              <AppText style={styles.detailMiniLabel}>Collection Day</AppText>
              <AppText style={styles.detailMiniValue}>{collectionDayLabel}</AppText>
            </View>
          </View>
        ) : null}
        {s?.startDate ? (
          <View style={styles.detailMiniCard}>
            <View style={styles.detailMiniIconBox}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.detailMiniTextCol}>
              <AppText style={styles.detailMiniLabel}>Start date</AppText>
              <AppText style={styles.detailMiniValue}>{formatDate(s.startDate)}</AppText>
            </View>
          </View>
        ) : null}
      </View>

      <View style={[styles.paymentCard, { borderLeftColor: paymentCardBorderColor }]}>
        <AppText style={styles.paymentSummaryTitle}>Payment Summary</AppText>
        {originalDiscountLines && showAmountRow ? (
          <View style={styles.paymentLineRow}>
            <AppText style={styles.paymentLineLeft}>Standard Rate</AppText>
            <AppText style={styles.paymentLineStrike}>{originalDiscountLines.originalFormatted}</AppText>
          </View>
        ) : null}
        {originalDiscountLines && showAmountRow ? (
          <View style={[styles.paymentLineRow, { flexWrap: "wrap" }]}>
            <AppText style={styles.paymentLineLeft}>Sustainability Discount</AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={styles.discountPctPill}>
                <AppText style={styles.discountPctPillText}>
                  {originalDiscountLines.discountPercent}% OFF
                </AppText>
              </View>
              <AppText style={styles.discountSavings}>{savingsFormatted}</AppText>
            </View>
          </View>
        ) : null}
        {originalDiscountLines && showAmountRow ? <View style={styles.paymentDividerDotted} /> : null}
        {showAmountRow ? (
          <View style={styles.paymentTotalRow}>
            <View style={styles.paymentTotalLeftBlock}>
              <AppText style={styles.paymentTotalLabel}>
                {showAmountAsPaid ? "Total amount paid" : "Total Amount Due"}
              </AppText>
              <AppText style={styles.paymentTotalAmount}>{amountValue}</AppText>
            </View>
            <View style={styles.paymentMetaRight}>
              <AppText style={styles.paymentMetaSmall}>via MoMo</AppText>
              {dueMetaLine ? (
                <AppText style={styles.paymentMetaSmallTight}>{dueMetaLine}</AppText>
              ) : null}
            </View>
          </View>
        ) : null}
        {showLastPaymentRow ? (
          <View style={[styles.fullWidthBlock, styles.paymentLastPaymentBlock]}>
            <AppText style={styles.fieldLabel}>Date of last payment</AppText>
            <AppText style={styles.fieldValue}>{lastPayment}</AppText>
          </View>
        ) : null}
      </View>

      {cancelDate ? (
        <AppText style={styles.cancelNote}>Cancelled on {cancelDate}</AppText>
      ) : null}

      {showSubscriptionActions && s ? (
        <View style={styles.actionsBlock}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleAddPickupDay}>
            <AppText style={styles.primaryButtonText}>Add another pickup day</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.secondaryButton, styles.dangerOutlineButton]}
            onPress={() => handleCancelSubscription(s)}
            disabled={cancellingSubscription}
          >
            {cancellingSubscription ? (
              <ActivityIndicator color={COLORS.error} />
            ) : (
              <AppText style={[styles.secondaryButtonText, styles.dangerOutlineText]}>
                Cancel Subscription
              </AppText>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {showCancelBooking && b ? (
        <View style={styles.actionsBlock}>
          <TouchableOpacity
            style={[styles.secondaryButton, styles.dangerOutlineButton]}
            onPress={() => handleDeleteBooking(b)}
            disabled={deletingBooking || processingPayment || verifyingBooking}
          >
            {deletingBooking ? (
              <ActivityIndicator color={COLORS.error} />
            ) : (
              <AppText style={[styles.secondaryButtonText, styles.dangerOutlineText]}>
                Cancel Booking
              </AppText>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {showSubscriptionPaymentActions && s ? (
        <View style={styles.actionsBlock}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleCompleteSubscriptionPayment(s)}
            disabled={completingSubscriptionPayment || verifyingSubscriptionPayment}
          >
            {completingSubscriptionPayment ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <AppText style={styles.primaryButtonText}>Pay Now</AppText>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleVerifySubscriptionPayment(s)}
            disabled={completingSubscriptionPayment || verifyingSubscriptionPayment}
          >
            {verifyingSubscriptionPayment ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <AppText style={styles.secondaryButtonText}>Verify Payment</AppText>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      {showBookingPaymentActions && b ? (
        <View style={styles.actionsBlock}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => handleContinuePaymentBooking(b)}
            disabled={processingPayment || verifyingBooking || deletingBooking}
          >
            {processingPayment ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <AppText style={styles.primaryButtonText}>Pay Now</AppText>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => handleManualVerifyBooking(b)}
            disabled={processingPayment || verifyingBooking || deletingBooking}
          >
            {verifyingBooking ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <AppText style={styles.secondaryButtonText}>Verify Payment</AppText>
            )}
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        style={styles.supportCard}
        onPress={handleContactSupport}
        activeOpacity={0.75}
      >
        <View style={styles.supportRow}>
          <Ionicons name="chatbubble-ellipses-outline" size={26} color={COLORS.primary} />
          <View style={styles.supportRowTextWrap}>
            <AppText style={styles.supportRowTitle}>Need help with your booking?</AppText>
            <AppText style={styles.supportRowSubtitle}>Our team is available on WhatsApp</AppText>
          </View>
          <Ionicons name="chevron-forward" size={22} color={COLORS.textSecondary} />
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
};
