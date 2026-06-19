import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, AppButton, TimeWindowPicker, ResponsiveContent } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { TIME_WINDOWS, TimeWindowId } from '@/lib/time-windows';
import type { BookingType } from '@/types/booking';
import { serverTimestamp } from 'firebase/firestore';
import { createBooking, initiatePaymentForBooking, updateBooking } from '@/services/booking-service';
import { createSubscription, confirmFreeBooking } from '@/services/payments';
import { mergeSubscriptionPaymentReference, saveSubscriptionRecord } from '@/services/subscription-service';
import * as Linking from 'expo-linking';
import { CustomerStackParamList } from '@/navigation/types';
import { styles } from './create-booking-screen.styles';
import { trackEvent } from '@/services/analytics';
import { SubscriptionCollectionCalendarModal } from './subscription-collection-calendar-modal';
import {
  getSubscriptionDiscount,
  intervalWeeksToDiscountFrequency,
  formatSubscriptionDiscountBadge,
  type SubscriptionDiscountFrequency,
} from '@/lib/subscription-discount';

type CreateBookingScreenProps = NativeStackScreenProps<
  CustomerStackParamList,
  'CreateBooking'
>;

const SCREEN = 'create_booking';

const COLLECTION_DAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

function startOfDayLocal(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return startOfDayLocal(x);
}

/** First selectable subscription start: past + today + next 2 calendar days blocked. */
function formatSubscriptionStartDisplay(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const formatDayLabel = (day: string) =>
  day.charAt(0).toUpperCase() + day.slice(1);

function subscriptionRecurringHelperCopy(
  intervalWeeks: number,
  weekdayDisplay: string
): string {
  if (intervalWeeks === 1) {
    return `Your pickups will repeat every ${weekdayDisplay} from this date`;
  }
  if (intervalWeeks === 2) {
    return `Your pickups will repeat every other ${weekdayDisplay} from this date`;
  }
  return `Your pickups will repeat on the ${weekdayDisplay} of each month from this date`;
}

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

const formatPrice = (value: number) => `GHS ${value.toFixed(2)}`;

/** Pickups included in each billed period (weekly/biweekly: 28-day cycle; monthly: one calendar pickup). */
function pickupsPerBillingPeriod(intervalWeeks: number): number {
  if (intervalWeeks === 1) return 4;
  if (intervalWeeks === 2) return 2;
  return 1;
}

function subscriptionPeriodAmounts(onePickupTotal: number, intervalWeeks: number) {
  const pickups = pickupsPerBillingPeriod(intervalWeeks);
  const undiscounted = onePickupTotal * pickups;
  const frequency = intervalWeeksToDiscountFrequency(intervalWeeks);
  const discountRate = getSubscriptionDiscount(frequency);
  const discounted = undiscounted * (1 - discountRate);
  return { pickups, undiscounted, discounted, discountRate, frequency };
}

const FREQUENCY_OPTIONS: {
  intervalWeeks: 1 | 2 | 4;
  frequency: SubscriptionDiscountFrequency;
  title: string;
  pickupsCopy: string;
  billingCopy: string;
  pricePeriodSuffix: string;
}[] = [
  {
    intervalWeeks: 1,
    frequency: "weekly",
    title: "Weekly",
    pickupsCopy: "4 pickups covered",
    billingCopy: "Billed every 28 days",
    pricePeriodSuffix: "/28 days",
  },
  {
    intervalWeeks: 2,
    frequency: "biweekly",
    title: "Biweekly",
    pickupsCopy: "2 pickups covered",
    billingCopy: "Billed every 28 days",
    pricePeriodSuffix: "/28 days",
  },
  {
    intervalWeeks: 4,
    frequency: "monthly",
    title: "Monthly",
    pickupsCopy: "1 pickup covered",
    billingCopy: "Billed monthly",
    pricePeriodSuffix: "/month",
  },
];

export const CreateBookingScreen: React.FC<CreateBookingScreenProps> = ({
  route,
  navigation,
}) => {
  const { items, totalPrice } = route.params;
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showOneOffCalendar, setShowOneOffCalendar] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState<TimeWindowId | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [bookingType, setBookingType] = useState<BookingType>("one_off");
  const [intervalWeeks, setIntervalWeeks] = useState<number>(1);
  /** Map intervalWeeks to collectionFrequency: 1=weekly, 2=biweekly, 4=monthly. Billing is always monthly. */
  const collectionFrequency: "weekly" | "biweekly" | "monthly" =
    intervalWeeks === 1 ? "weekly" : intervalWeeks === 2 ? "biweekly" : "monthly";
  const [subscriptionStartDate, setSubscriptionStartDate] = useState<Date | null>(null);
  const [showSubscriptionCalendar, setShowSubscriptionCalendar] = useState(false);
  const subscriptionFlowInFlightRef = useRef(false);

  const collectionDayKey = useMemo(() => {
    if (!subscriptionStartDate) return null;
    return COLLECTION_DAYS[subscriptionStartDate.getDay()];
  }, [subscriptionStartDate]);

  const minimumPickupCalendarDate = useMemo(
    () => addDaysLocal(startOfDayLocal(new Date()), 3),
    []
  );

  const locationMissing = !user?.location;
  const hasItems = items.length > 0;

  const isOneTimeConfirmDisabled =
    !user ||
    !selectedDate ||
    !selectedWindowId ||
    !user?.location ||
    !hasItems ||
    isSaving;

  const isSubscription = bookingType === "subscription";

  const subscriptionPeriodPricing = useMemo(
    () => subscriptionPeriodAmounts(totalPrice, intervalWeeks),
    [totalPrice, intervalWeeks]
  );

  const discountedTotal = useMemo(() => {
    if (!isSubscription) {
      return totalPrice;
    }
    return subscriptionPeriodPricing.discounted;
  }, [isSubscription, totalPrice, subscriptionPeriodPricing.discounted]);

  const subscriptionUndiscountedTotal = useMemo(() => {
    if (!isSubscription) {
      return totalPrice;
    }
    return subscriptionPeriodPricing.undiscounted;
  }, [isSubscription, totalPrice, subscriptionPeriodPricing.undiscounted]);

  const isSubscriptionStartDisabled =
    !user ||
    !user?.location ||
    !hasItems ||
    !subscriptionStartDate ||
    discountedTotal <= 0 ||
    isSaving;

  const selectedWindowLabel = useMemo(() => {
    if (!selectedWindowId) {
      return null;
    }
    return TIME_WINDOWS.find((window) => window.id === selectedWindowId)?.label;
  }, [selectedWindowId]);

  const savings = useMemo(() => {
    if (!isSubscription) {
      return 0;
    }
    return subscriptionUndiscountedTotal - discountedTotal;
  }, [isSubscription, subscriptionUndiscountedTotal, discountedTotal]);

  const selectedSubscriptionDiscountPercent = useMemo(() => {
    if (!isSubscription) {
      return 0;
    }
    return Math.round(getSubscriptionDiscount(collectionFrequency) * 100);
  }, [isSubscription, collectionFrequency]);

  useEffect(() => {
    trackEvent('checkout_viewed', { screen: 'checkout' });
  }, []);

  const handleStartSubscription = async () => {
    if (subscriptionFlowInFlightRef.current) {
      return;
    }
    if (!user?.email) {
      Alert.alert(
        'Email required',
        'We need your email to start the subscription. Please complete your profile.'
      );
      return;
    }
    if (!user?.location || !hasItems) {
      Alert.alert(
        'Missing info',
        'Please add your service area and at least one bin.'
      );
      return;
    }
    if (!subscriptionStartDate || !collectionDayKey) {
      Alert.alert('Please select your first collection date');
      return;
    }
    subscriptionFlowInFlightRef.current = true;
    try {
      setIsSaving(true);
      const startDateIso = subscriptionStartDate.toISOString().slice(0, 10);
      const defaultWindow = TIME_WINDOWS[0];
      let bookingId: string;
      try {
        bookingId = await createBooking({
          userId: user.id,
          userEmail: user.email,
          date: startDateIso,
          windowId: defaultWindow.id,
          windowLabel: defaultWindow.label,
          location: user.location ?? '',
          items,
          totalPrice: discountedTotal,
          type: 'subscription',
          recurrence: { intervalWeeks },
        });
      } catch (bookingErr: any) {
        console.error('Subscription booking create error:', bookingErr);
        Alert.alert(
          'Booking failed',
          bookingErr?.message?.includes('network') || bookingErr?.message?.includes('Network')
            ? 'Check your internet connection and try again.'
            : bookingErr?.message ?? 'Could not create subscription booking. Please try again.'
        );
        return;
      }
      let authorizationUrl: string;
      let reference: string;
      let subscriptionId: string | undefined;
      try {
        const result = await createSubscription({
          userId: user.id,
          email: user.email ?? '',
          amount: discountedTotal,
          bookingId,
          collectionFrequency,
          collectionDay: collectionDayKey.toLowerCase(),
          startDate: startDateIso,
          items: items.map((i) => ({
            type: i.type,
            quantity: i.quantity ?? 1,
            unitPrice: i.unitPrice,
            totalPrice: i.totalPrice,
          })),
          location: user.location ?? '',
          metadata: {
            binType: items.map((i) => i.type).join(', '),
            quantity: items.reduce((acc, i) => acc + (i.quantity ?? 1), 0),
            location: user.location ?? '',
            startDate: startDateIso,
          },
        });
        authorizationUrl = result.authorizationUrl;
        reference = result.reference;
        subscriptionId = result.subscriptionId;
        await updateBooking(bookingId, {
          ...(subscriptionId ? { subscriptionId } : {}),
          payment: {
            status: 'initiated',
            reference,
            authorizationUrl,
            amount: discountedTotal,
            initiatedAt: serverTimestamp(),
          },
        });
        if (subscriptionId) {
          try {
            await mergeSubscriptionPaymentReference(subscriptionId, reference);
          } catch (mergeErr) {
            console.warn('Subscription reference merge (client):', mergeErr);
          }
        }
      } catch (subscriptionErr: any) {
        console.error('Subscription start error:', subscriptionErr);
        await trackEvent('activation_failed', { screen: SCREEN, reason: 'subscription_init' });
        const msg = subscriptionErr?.message ?? 'Could not start subscription. Please try again.';
        Alert.alert(
          'Payment link failed',
          msg.includes('Cannot reach the server')
            ? msg + ' If using a device, ensure it can reach the API (e.g. use a deployed URL, not localhost).'
            : msg
        );
        return;
      }

      if (!subscriptionId) {
        await saveSubscriptionRecord({
          userId: user.id,
          reference,
          status: 'pending',
          amount: discountedTotal,
          collectionFrequency,
          collectionDay: collectionDayKey.toLowerCase(),
          startDate: startDateIso,
          bookingId,
          interval: intervalWeeks === 1 ? 'weekly' : 'monthly',
          metadata: { items: items.length, startDate: startDateIso },
        });
      }

      await trackEvent('payment_started', {
        screen: 'checkout',
        amount: Number(discountedTotal),
        currency: 'GHS',
        provider: 'paystack',
        type: 'subscription',
      });
      await Linking.openURL(authorizationUrl);

      Alert.alert(
        'Complete payment to activate',
        'Complete your payment in the opened page to activate your subscription. Status will update automatically.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      console.error('Subscription start error:', err);
      await trackEvent('activation_failed', { screen: SCREEN, reason: 'subscription_init' });
      Alert.alert('Error', err?.message ?? 'Could not start subscription. Please try again.');
    } finally {
      subscriptionFlowInFlightRef.current = false;
      setIsSaving(false);
    }
  };

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
        userEmail: user.email,
        date: dateStr,
        windowId: windowDef.id,
        windowLabel: windowDef.label,
        location: user.location,
        items,
        totalPrice: totalPrice,
        type: 'one_off',
      });
      await trackEvent('activation_completed', {
        screen: SCREEN,
        type: 'one_off',
      });

      if (totalPrice === 0) {
        await confirmFreeBooking(bookingId);
        await trackEvent('payment_started', {
          screen: 'checkout',
          amount: 0,
          currency: 'GHS',
          provider: 'free',
        });
        Alert.alert(
          'Booking confirmed',
          `Your ${selectedWindowLabel.toLowerCase()} pickup on ${formatDate(
            selectedDate
          )} is confirmed. No payment needed.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }]
        );
        return;
      }

      const { authorizationUrl } = await initiatePaymentForBooking(bookingId);

      await trackEvent('payment_started', {
        screen: 'checkout',
        amount: Number(totalPrice),
        currency: 'GHS',
        provider: 'paystack',
      });
      await trackEvent('payment_provider_opened', {
        screen: 'checkout',
        provider: 'paystack',
      });

      await Linking.openURL(authorizationUrl);

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
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <ResponsiveContent innerStyle={styles.form}>
        <AppText style={styles.title}>Schedule a pickup</AppText>
        <AppText style={styles.subtitle}>
          Choose a date and time window for your waste collection.
        </AppText>

        <AppText style={styles.label}>Pickup type</AppText>
        <View style={styles.windowButtonsContainer}>
          <TouchableOpacity
            style={[
              styles.windowButton,
              bookingType === "one_off" && styles.windowButtonSelected,
            ]}
            onPress={() => {
              setBookingType("one_off");
              trackEvent('payment_plan_selected', { screen: SCREEN, type: 'one_off' });
            }}
          >
            <AppText
              style={[
                styles.windowButtonText,
                bookingType === "one_off" && styles.windowButtonTextSelected,
              ]}
            >
              One-time pickup
            </AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.windowButton,
              bookingType === "subscription" && styles.windowButtonSelected,
            ]}
            onPress={() => {
              setBookingType("subscription");
              trackEvent('payment_plan_selected', { screen: SCREEN, type: 'subscription' });
            }}
          >
            <AppText
              style={[
                styles.windowButtonText,
                bookingType === "subscription" && styles.windowButtonTextSelected,
              ]}
            >
              Subscription
            </AppText>
          </TouchableOpacity>
        </View>

        {isSubscription && (
          <>
            <AppText style={styles.subtitle}>
              Recurring pickups at a discount. You can cancel anytime from My Bookings.
            </AppText>
            <AppText style={styles.label}>Collection frequency</AppText>
            <View style={styles.windowButtonsContainer}>
              {FREQUENCY_OPTIONS.map((opt) => {
                const isSelected = intervalWeeks === opt.intervalWeeks;
                const { undiscounted, discounted } = subscriptionPeriodAmounts(
                  totalPrice,
                  opt.intervalWeeks
                );
                return (
                  <TouchableOpacity
                    key={opt.intervalWeeks}
                    style={[
                      styles.windowButton,
                      isSelected && styles.windowButtonSelected,
                    ]}
                    onPress={() => setIntervalWeeks(opt.intervalWeeks)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <View style={styles.frequencyCardInner}>
                      <View style={styles.frequencyCardTitleRow}>
                        <AppText
                          style={[
                            styles.frequencyCardTitle,
                            isSelected && styles.frequencyCardTitleSelected,
                          ]}
                        >
                          {opt.title}
                        </AppText>
                        <View style={styles.frequencyDiscountBadge}>
                          <AppText style={styles.frequencyDiscountBadgeText}>
                            {formatSubscriptionDiscountBadge(opt.frequency)}
                          </AppText>
                        </View>
                      </View>
                      <AppText
                        style={[
                          styles.frequencyCardDetail,
                          isSelected && styles.frequencyCardDetailSelected,
                        ]}
                      >
                        {`${opt.pickupsCopy} · ${opt.billingCopy}`}
                      </AppText>
                      <View style={styles.frequencyPriceRow}>
                        <AppText style={styles.frequencyPriceOriginal}>
                          {formatPrice(undiscounted)}
                          {opt.pricePeriodSuffix}
                        </AppText>
                        <AppText style={styles.frequencyPriceDiscount}>
                          {formatPrice(discounted)}
                          {opt.pricePeriodSuffix}
                        </AppText>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <AppText style={styles.label}>Select your collection day</AppText>
            <TouchableOpacity
              style={styles.dayDropdown}
              onPress={() => setShowSubscriptionCalendar(true)}
            >
              <AppText
                style={
                  subscriptionStartDate
                    ? styles.dayDropdownText
                    : styles.dayDropdownPlaceholder
                }
              >
                {subscriptionStartDate
                  ? formatSubscriptionStartDisplay(subscriptionStartDate)
                  : 'Select first collection date'}
              </AppText>
            </TouchableOpacity>
            {subscriptionStartDate && collectionDayKey && (
              <AppText style={styles.collectionHelperText}>
                {subscriptionRecurringHelperCopy(
                  intervalWeeks,
                  formatDayLabel(collectionDayKey)
                )}
              </AppText>
            )}
            <SubscriptionCollectionCalendarModal
              visible={showSubscriptionCalendar}
              onClose={() => setShowSubscriptionCalendar(false)}
              minimumDate={minimumPickupCalendarDate}
              selectedDate={subscriptionStartDate}
              onSelectDate={setSubscriptionStartDate}
            />
          </>
        )}

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
                  {formatPrice(subscriptionUndiscountedTotal)}
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
                You’re saving {formatPrice(savings)} with a {selectedSubscriptionDiscountPercent}% subscription discount.
              </AppText>
            </View>
          )}
          {isSubscription && subscriptionStartDate && collectionDayKey && (
            <View style={{ marginTop: 8 }}>
              <AppText style={styles.summaryItemMeta}>
                First collection: {formatSubscriptionStartDisplay(subscriptionStartDate)}
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

        {!isSubscription && (
          <>
            <AppText style={styles.label}>Date</AppText>
            <TouchableOpacity
              style={styles.dayDropdown}
              onPress={() => setShowOneOffCalendar(true)}
            >
              <AppText
                style={
                  selectedDate ? styles.dayDropdownText : styles.dayDropdownPlaceholder
                }
              >
                {selectedDate
                  ? formatSubscriptionStartDisplay(selectedDate)
                  : 'Select pickup date'}
              </AppText>
            </TouchableOpacity>
            <SubscriptionCollectionCalendarModal
              visible={showOneOffCalendar}
              onClose={() => setShowOneOffCalendar(false)}
              minimumDate={minimumPickupCalendarDate}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              title="Pickup date"
              subtitle="Choose when you'd like your pickup. Past dates and the next two days are not available."
            />

            <AppText style={styles.label}>Time window</AppText>
            <TimeWindowPicker
              selectedWindowId={selectedWindowId}
              onSelect={setSelectedWindowId}
            />
          </>
        )}

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

        {isSubscription ? (
          <AppButton
            title="Pay with MoMo"
            onPress={handleStartSubscription}
            disabled={isSubscriptionStartDisabled || locationMissing}
            loading={isSaving}
            buttonStyle={{
              ...styles.confirmButton,
              ...(isSubscriptionStartDisabled || locationMissing ? styles.confirmButtonDisabled : {}),
            }}
            textStyle={styles.confirmButtonText}
          />
        ) : (
          <AppButton
            title="Confirm booking"
            onPress={handleConfirm}
            disabled={isOneTimeConfirmDisabled || locationMissing}
            loading={isSaving}
            buttonStyle={{
              ...styles.confirmButton,
              ...(isOneTimeConfirmDisabled || locationMissing
                ? styles.confirmButtonDisabled
                : {}),
            }}
            textStyle={styles.confirmButtonText}
          />
        )}
      </ResponsiveContent>
    </ScrollView>
  );
};


