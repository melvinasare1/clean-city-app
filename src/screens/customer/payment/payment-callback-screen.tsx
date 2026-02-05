import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, Alert } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { AppText, AppButton } from "@/components";
import { CustomerStackParamList } from "@/navigation/types";
import { verifyPayment, VerifyPaymentResponse } from "@/services/payments";
import { COLORS } from "@/lib/constants";
import { trackEvent } from "@/services/analytics";
import { useAuth } from "@/hooks/useAuth";
import { handleBookingPaymentSuccess } from "@/services/booking-service";

type Props = NativeStackScreenProps<CustomerStackParamList, "PaymentCallback">;

const SCREEN = "checkout";

const getPaymentFailureReason = (status: VerifyPaymentResponse["status"]): string => {
  switch (status) {
    case "failed":
      return "declined";
    case "abandoned":
      return "cancelled";
    case "pending":
      return "timeout";
    default:
      return "unknown";
  }
};

export const PaymentCallbackScreen: React.FC<Props> = ({
  route,
  navigation,
}) => {
  const { reference } = route.params;
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerifyPaymentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const run = async () => {
      try {
        const verifyResult = await verifyPayment(reference);
        setResult(verifyResult);

        if (verifyResult.status === "success") {
          // Booking is successfully paid at this point.
          // Update booking payment status and trigger referral reward logic.
          const bookingId = (verifyResult.metadata as any)?.bookingId;
          const referredUserId =
            (verifyResult.metadata as any)?.userId ?? user?.id ?? null;
          
          if (bookingId) {
            await handleBookingPaymentSuccess(bookingId, referredUserId);
          }

          await trackEvent("payment_completed", {
            screen: SCREEN,
            amount: verifyResult.amount,
            currency: verifyResult.currency,
            provider: "paystack",
          });

          Alert.alert("Payment successful", "Your payment has been confirmed.");
        } else {
          const reason = getPaymentFailureReason(verifyResult.status);

          await trackEvent("payment_failed", {
            screen: SCREEN,
            provider: "paystack",
            reason,
          });

          Alert.alert(
            "Payment not successful",
            `Status: ${verifyResult.status}`
          );
        }
      } catch (err: any) {
        console.error("Error verifying payment:", err);
        setError(err?.message || "Failed to verify payment");

        const message = (err?.message as string | undefined)?.toLowerCase() ?? "";
        const reason = message.includes("network") ? "network_error" : "unknown";

        await trackEvent("payment_failed", {
          screen: SCREEN,
          provider: "paystack",
          reason,
        });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [reference]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
        <AppText style={{ marginTop: 16 }}>Verifying your payment...</AppText>
      </View>
    );
  }

  if (error || !result) {
    return (
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <AppText style={{ marginBottom: 8, color: COLORS.error, fontSize: 18 }}>
          Payment verification failed
        </AppText>
        <AppText style={{ marginBottom: 24 }}>
          {error ?? "Unknown error"}
        </AppText>
        <AppButton
          title="Go back"
          onPress={() => navigation.navigate("CustomerTabs")}
        />
      </View>
    );
  }

  const isSuccess = result.status === "success";

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
      <AppText
        style={{
          fontSize: 22,
          fontWeight: "600",
          marginBottom: 12,
          color: isSuccess ? COLORS.success : COLORS.error,
        }}
      >
        {isSuccess ? "Payment successful" : "Payment not successful"}
      </AppText>

      <AppText style={{ marginBottom: 4 }}>
        Reference: {result.reference}
      </AppText>
      <AppText style={{ marginBottom: 4 }}>
        Amount: {result.amount.toFixed(2)} {result.currency}
      </AppText>
      <AppText style={{ marginBottom: 24 }}>Status: {result.status}</AppText>

      <AppButton
        title="Back to bookings"
        onPress={() => navigation.navigate("MyBookings")}
      />
    </View>
  );
};


