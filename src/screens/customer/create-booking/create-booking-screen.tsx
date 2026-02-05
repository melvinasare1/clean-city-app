import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, Alert, ScrollView } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, AppButton } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { TIME_WINDOWS, TimeWindowId } from '@/lib/time-windows';
import type { BookingType } from '@/types/booking';
import { createBooking, initiatePaymentForBooking } from '@/services/booking-service';
import * as Linking from 'expo-linking';
import { CustomerStackParamList } from '@/navigation/types';
import { styles } from './create-booking-screen.styles';
import { trackEvent } from '@/services/analytics';

type CreateBookingScreenProps = NativeStackScreenProps<
  CustomerStackParamList,
  'CreateBooking'
>;

const SCREEN = 'create_booking';

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatPrice = (value: number) => `GHS ${value.toFixed(2)}`;

export const CreateBookingScreen: React.FC<CreateBookingScreenProps> = ({
  route,
  navigation,
}) => {
  const { items, totalPrice } = route.params;
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState<TimeWindowId | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [bookingType, setBookingType] = useState<BookingType>("one_off");
  const [intervalWeeks, setIntervalWeeks] = useState<number>(1);

  const locationMissing = !user?.location;
  const hasItems = items.length > 0;

  const dateLabel = selectedDate
    ? formatDate(selectedDate)
    : 'Select a date (today or later)';

  const handleDateChange = (_: DateTimePickerEvent, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  const isConfirmDisabled =
    !user ||
    !selectedDate ||
    !selectedWindowId ||
    !user?.location ||
    !hasItems ||
    isSaving;

  const selectedWindowLabel = useMemo(() => {
    if (!selectedWindowId) {
      return null;
    }
    return TIME_WINDOWS.find((window) => window.id === selectedWindowId)?.label;
  }, [selectedWindowId]);

  const isSubscription = bookingType === "subscription";

  const discountedTotal = useMemo(() => {
    if (!isSubscription) {
      return totalPrice;
    }
    return totalPrice * 0.9;
  }, [isSubscription, totalPrice]);

  const savings = useMemo(() => {
    if (!isSubscription) {
      return 0;
    }
    return totalPrice - discountedTotal;
  }, [isSubscription, totalPrice, discountedTotal]);

  useEffect(() => {
    trackEvent('checkout_viewed', { screen: 'checkout' });
  }, []);

  const handleConfirm = async () => {
    if (!user) {
      Alert.alert('Error', 'You need to be logged in to schedule a pickup.');
      return;
    }
    if (!selectedDate || !selectedWindowId || !selectedWindowLabel) {
      Alert.alert(
        'Missing info',
        'Please select both a date and a time window.'
      );
      return;
    }
    if (!user.location) {
      Alert.alert(
        'Missing location',
        'Please complete your profile with a service area before scheduling.'
      );
      return;
    }
    if (!hasItems) {
      Alert.alert(
        'Missing bins',
        'Please go back and select at least one bin before scheduling.'
      );
      return;
    }

    try {
      setIsSaving(true);
      const dateStr = selectedDate.toISOString().slice(0, 10);
      const windowDef = TIME_WINDOWS.find(
        (window) => window.id === selectedWindowId
      );
      if (!windowDef) {
        throw new Error('Invalid time window');
      }

      const bookingId = await createBooking({
        userId: user.id,
        date: dateStr,
        windowId: windowDef.id,
        windowLabel: windowDef.label,
        location: user.location,
        items,
        totalPrice: discountedTotal,
        type: bookingType,
        recurrence:
          isSubscription
            ? {
              intervalWeeks,
            }
            : undefined,
      });
      await trackEvent('activation_completed', {
        screen: SCREEN,
        type: bookingType,
      });

      if (!user.email) {
        Alert.alert(
          'Missing email',
          'We need your email address to process the payment. Please update your profile.'
        );
        return;
      }

      console.log('Initializing payment for booking:', bookingId);

      const { authorizationUrl } = await initiatePaymentForBooking(
        bookingId,
        user.email
      );

      console.log('Payment initialized with URL:', authorizationUrl);

      // ✅ Open Paystack payment page in browser
      const url = authorizationUrl;
      console.log('Opening Paystack URL:', url);

      await trackEvent('payment_started', {
        screen: 'checkout',
        amount: Number(discountedTotal),
        currency: 'GHS',
        provider: 'paystack',
      });

      await trackEvent('payment_provider_opened', {
        screen: 'checkout',
        provider: 'paystack',
      });

      await Linking.openURL(url);

      Alert.alert(
        'Complete payment to confirm',
        `Your ${selectedWindowLabel.toLowerCase()} pickup on ${formatDate(
          selectedDate
        )} is almost ready. Please complete your payment in the opened page to confirm your booking.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (paymentError: any) {
      console.error('Error during booking + payment flow:', paymentError);

      const message = (paymentError?.message as string | undefined)?.toLowerCase() ?? '';
      const reason = message.includes('network') ? 'network_error' : 'unknown';

      await trackEvent('activation_failed', {
        screen: SCREEN,
        reason,
      });

      Alert.alert(
        'Error',
        `Something went wrong: ${paymentError?.message ?? String(paymentError)}`
      );
    } finally {
      setIsSaving(false);
    }
  };


  return (
    <ScrollView>
      <View style={styles.form}>
        <AppText style={styles.title}>Schedule a pickup</AppText>
        <AppText style={styles.subtitle}>
          Choose a date and time window for your waste collection.
        </AppText>

        {/* Temporarily disabled subscription feature */}
        {/* <AppText style={styles.label}>Pickup type</AppText>
        <View style={styles.windowButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.windowButton,
              bookingType === "one_off" && styles.windowButtonSelected,
            ]}
            onPress={() => {
              setBookingType("one_off");
              trackEvent('payment_plan_selected', {
                screen: SCREEN,
                type: 'one_off',
              });
            }}
          >
            <AppText
              style={[
                styles.windowButtonText,
                bookingType === "one_off" && styles.windowButtonTextSelected,
              ]}
            >
              One-off pickup
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.windowButton,
              bookingType === "subscription" && styles.windowButtonSelected,
            ]}
            onPress={() => {
              setBookingType("subscription");
              trackEvent('payment_plan_selected', {
                screen: SCREEN,
                type: 'subscription',
              });
            }}
          >
            <AppText
              style={[
                styles.windowButtonText,
                bookingType === "subscription" && styles.windowButtonTextSelected,
              ]}
            >
              Recurring subscription
            </AppText>
          </TouchableOpacity>
        </View>

        {bookingType === "subscription" && (
          <>
            <AppText style={styles.subtitle}>
              This pickup will repeat automatically. You can contact support to
              update or cancel your subscription.
            </AppText>
            <AppText style={styles.label}>Recurrence</AppText>
            <View style={styles.windowButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.windowButton,
                  intervalWeeks === 1 && styles.windowButtonSelected,
                ]}
                onPress={() => setIntervalWeeks(1)}
              >
                <AppText
                  style={[
                    styles.windowButtonText,
                    intervalWeeks === 1 && styles.windowButtonTextSelected,
                  ]}
                >
                  Every week
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.windowButton,
                  intervalWeeks === 2 && styles.windowButtonSelected,
                ]}
                onPress={() => setIntervalWeeks(2)}
              >
                <AppText
                  style={[
                    styles.windowButtonText,
                    intervalWeeks === 2 && styles.windowButtonTextSelected,
                  ]}
                >
                  Every 2 weeks
                </AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.windowButton,
                  intervalWeeks === 4 && styles.windowButtonSelected,
                ]}
                onPress={() => setIntervalWeeks(4)}
              >
                <AppText
                  style={[
                    styles.windowButtonText,
                    intervalWeeks === 4 && styles.windowButtonTextSelected,
                  ]}
                >
                  Every 4 weeks
                </AppText>
              </TouchableOpacity>
            </View>
          </>
        )} */}

        <View style={styles.summaryCard}>
          <AppText style={styles.summaryTitle}>Selected bins</AppText>
          {items.map((item) => (
            <View key={item.id ?? item.type} style={styles.summaryItem}>
              <AppText style={styles.summaryItemType}>
                {item.quantity} x {item.type}
              </AppText>
              <AppText style={styles.summaryItemMeta}>
                {formatPrice(item.unitPrice)} each • {formatPrice(item.totalPrice)}
              </AppText>
            </View>
          ))}
          <View style={styles.summaryDivider} />
          <View style={styles.summaryTotalRow}>
            <AppText style={styles.summaryTotalLabel}>
              {isSubscription ? 'Subscription total' : 'Total'}
            </AppText>
            {isSubscription ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <AppText
                  style={[styles.summaryOriginalValue, { marginRight: 8 }]}
                >
                  {formatPrice(totalPrice)}
                </AppText>
                <AppText style={styles.summaryTotalValue}>
                  {formatPrice(discountedTotal)}
                </AppText>
              </View>
            ) : (
              <AppText style={styles.summaryTotalValue}>
                {formatPrice(totalPrice)}
              </AppText>
            )}
          </View>
          {isSubscription && savings > 0 && (
            <View style={{ marginTop: 4 }}>
              <AppText style={styles.summarySavingsText}>
                You’re saving {formatPrice(savings)} with a 10% subscription discount.
              </AppText>
            </View>
          )}
        </View>

        {!hasItems && (
          <View style={styles.noItemsNotice}>
            <AppText style={styles.noItemsText}>
              No bins selected. Please go back and add bins before confirming.
            </AppText>
          </View>
        )}

        <AppText style={styles.label}>Date</AppText>
        <TouchableOpacity
          style={styles.dateSelector}
          onPress={() => setShowDatePicker(true)}
        >
          <AppText style={styles.dateSelectorText}>{dateLabel}</AppText>
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={selectedDate ?? new Date()}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        <AppText style={styles.label}>Time window</AppText>
        <View style={styles.windowButtonsContainer}>
          {TIME_WINDOWS.map((window) => {
            const isSelected = window.id === selectedWindowId;
            return (
              <TouchableOpacity
                key={window.id}
                style={[
                  styles.windowButton,
                  isSelected && styles.windowButtonSelected,
                ]}
                onPress={() => setSelectedWindowId(window.id)}
              >
                <AppText
                  style={[
                    styles.windowButtonText,
                    isSelected && styles.windowButtonTextSelected,
                  ]}
                >
                  {window.label}
                </AppText>
              </TouchableOpacity>
            );
          })}
        </View>

        <AppText style={styles.label}>Service area</AppText>
        {user?.location ? (
          <AppText style={styles.locationText}>
            Pickup area: {user.location}
          </AppText>
        ) : (
          <View style={styles.locationWarningContainer}>
            <AppText style={styles.locationWarning}>
              Add your service area to schedule pickups.
            </AppText>
            <TouchableOpacity
              style={styles.completeProfileLink}
              onPress={() => navigation.navigate('CompleteProfile')}
            >
              <AppText style={styles.completeProfileText}>
                Complete your profile
              </AppText>
            </TouchableOpacity>
          </View>
        )}

        <AppButton
          title="Confirm booking"
          onPress={handleConfirm}
          disabled={isConfirmDisabled || locationMissing}
          loading={isSaving}
          buttonStyle={{
            ...styles.confirmButton,
            ...(isConfirmDisabled || locationMissing
              ? styles.confirmButtonDisabled
              : {}),
          }}
          textStyle={styles.confirmButtonText}
        />
      </View>
    </ScrollView>
  );
};


