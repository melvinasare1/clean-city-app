import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { AppText, ResponsiveContent, TimeWindowPicker } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { TIME_WINDOWS, TimeWindowId } from '@/lib/time-windows';
import type { BookingBinItem, BookingType } from '@platform/shared-types';
import { serverTimestamp } from 'firebase/firestore';
import { createBooking, initiatePaymentForBooking, updateBooking } from '@/services/booking-service';
import { createSubscription, confirmFreeBooking } from '@/services/payments';
import { mergeSubscriptionPaymentReference, saveSubscriptionRecord } from '@/services/subscription-service';
import * as Linking from 'expo-linking';
import { CustomerStackParamList } from '@/navigation/types';
import { styles } from './create-booking-screen.styles';
import { trackEvent } from '@/services/analytics';
import { pickupAddressText } from '@/lib/profile-location';
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

type IoniconName = ComponentProps<typeof Ionicons>['name'];

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

function earliestPickupDate(): Date {
  return addDaysLocal(startOfDayLocal(new Date()), 3);
}

function formatLongDate(d: Date): string {
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

const formatPrice = (value: number) => `¢${value.toFixed(2)}`;

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
    frequency: 'weekly',
    title: 'Weekly',
    pickupsCopy: '4 pickups covered',
    billingCopy: 'Billed every 28 days',
    pricePeriodSuffix: '/28 days',
  },
  {
    intervalWeeks: 2,
    frequency: 'biweekly',
    title: 'Biweekly',
    pickupsCopy: '2 pickups covered',
    billingCopy: 'Billed every 28 days',
    pricePeriodSuffix: '/28 days',
  },
  {
    intervalWeeks: 4,
    frequency: 'monthly',
    title: 'Monthly',
    pickupsCopy: '1 pickup covered',
    billingCopy: 'Billed monthly',
    pricePeriodSuffix: '/month',
  },
];

function itemIcon(item: BookingBinItem): IoniconName {
  const id = (item.id ?? '').toUpperCase();
  const type = item.type.toLowerCase();
  if (id.includes('SMALL') || type.includes('bag')) return 'bag-handle-outline';
  if (id.includes('WHEELIE') || type.includes('wheelie')) return 'trash-outline';
  return 'file-tray-outline';
}

export const CreateBookingScreen: React.FC<CreateBookingScreenProps> = ({
  route,
  navigation,
}) => {
  const { items, totalPrice } = route.params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const address = pickupAddressText(user ?? {});

  const minimumPickupCalendarDate = useMemo(() => earliestPickupDate(), []);
  const [selectedDate, setSelectedDate] = useState<Date>(earliestPickupDate);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState<TimeWindowId>(
    TIME_WINDOWS[0].id
  );
  const [isSaving, setIsSaving] = useState(false);
  const [bookingType, setBookingType] = useState<BookingType>('one_off');
  const [intervalWeeks, setIntervalWeeks] = useState<number>(1);
  const collectionFrequency: 'weekly' | 'biweekly' | 'monthly' =
    intervalWeeks === 1 ? 'weekly' : intervalWeeks === 2 ? 'biweekly' : 'monthly';
  const subscriptionFlowInFlightRef = useRef(false);

  const collectionDayKey = useMemo(() => {
    if (!selectedDate) return null;
    return COLLECTION_DAYS[selectedDate.getDay()];
  }, [selectedDate]);

  const locationMissing = !address;
  const hasItems = items.length > 0;
  const isSubscription = bookingType === 'subscription';

  const subscriptionPeriodPricing = useMemo(
    () => subscriptionPeriodAmounts(totalPrice, intervalWeeks),
    [totalPrice, intervalWeeks]
  );

  const discountedTotal = useMemo(() => {
    if (!isSubscription) return totalPrice;
    return subscriptionPeriodPricing.discounted;
  }, [isSubscription, totalPrice, subscriptionPeriodPricing.discounted]);

  const subscriptionUndiscountedTotal = useMemo(() => {
    if (!isSubscription) return totalPrice;
    return subscriptionPeriodPricing.undiscounted;
  }, [isSubscription, totalPrice, subscriptionPeriodPricing.undiscounted]);

  const savings = useMemo(() => {
    if (!isSubscription) return 0;
    return subscriptionUndiscountedTotal - discountedTotal;
  }, [isSubscription, subscriptionUndiscountedTotal, discountedTotal]);

  const selectedSubscriptionDiscountPercent = useMemo(() => {
    if (!isSubscription) return 0;
    return Math.round(getSubscriptionDiscount(collectionFrequency) * 100);
  }, [isSubscription, collectionFrequency]);

  const selectedWindowLabel = useMemo(() => {
    return TIME_WINDOWS.find((window) => window.id === selectedWindowId)?.label;
  }, [selectedWindowId]);

  const displayTotal = isSubscription ? discountedTotal : totalPrice;

  const canContinue = isSubscription
    ? !!user &&
      !!address &&
      hasItems &&
      !!selectedDate &&
      discountedTotal > 0 &&
      !isSaving
    : !!user &&
      !!selectedDate &&
      !!selectedWindowId &&
      !!address &&
      hasItems &&
      !isSaving;

  useEffect(() => {
    trackEvent('checkout_viewed', { screen: 'checkout' });
  }, []);

  const handleHelp = () => {
    navigation.navigate('CustomerTabs', { screen: 'CustomerHelp' });
  };

  const handleChangeAddress = () => {
    navigation.navigate('SetPickupLocation', {
      initialAddress: address || undefined,
      initialLocation: user?.location ?? null,
      saveToProfile: true,
    });
  };

  const handleStartSubscription = async () => {
    if (subscriptionFlowInFlightRef.current) return;
    if (!user?.email) {
      Alert.alert(
        'Email required',
        'We need your email to start the subscription. Please complete your profile.'
      );
      return;
    }
    if (!address || !hasItems) {
      Alert.alert(
        'Missing info',
        'Please add your pickup address and at least one bin.'
      );
      return;
    }
    if (!selectedDate || !collectionDayKey) {
      Alert.alert('Please select your first collection date');
      return;
    }
    subscriptionFlowInFlightRef.current = true;
    try {
      setIsSaving(true);
      const startDateIso = selectedDate.toISOString().slice(0, 10);
      const defaultWindow = TIME_WINDOWS[0];
      let bookingId: string;
      try {
        bookingId = await createBooking({
          userId: user.id,
          userEmail: user.email,
          date: startDateIso,
          windowId: defaultWindow.id,
          windowLabel: defaultWindow.label,
          location: address,
          items,
          totalPrice: discountedTotal,
          type: 'subscription',
          recurrence: { intervalWeeks },
        });
      } catch (bookingErr: any) {
        console.error('Subscription booking create error:', bookingErr);
        Alert.alert(
          'Booking failed',
          bookingErr?.message?.includes('network') ||
            bookingErr?.message?.includes('Network')
            ? 'Check your internet connection and try again.'
            : bookingErr?.message ??
                'Could not create subscription booking. Please try again.'
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
          location: address,
          metadata: {
            binType: items.map((i) => i.type).join(', '),
            quantity: items.reduce((acc, i) => acc + (i.quantity ?? 1), 0),
            location: address,
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
        await trackEvent('activation_failed', {
          screen: SCREEN,
          reason: 'subscription_init',
        });
        const msg =
          subscriptionErr?.message ??
          'Could not start subscription. Please try again.';
        Alert.alert(
          'Payment link failed',
          msg.includes('Cannot reach the server')
            ? msg +
                ' If using a device, ensure it can reach the API (e.g. use a deployed URL, not localhost).'
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
      await trackEvent('activation_failed', {
        screen: SCREEN,
        reason: 'subscription_init',
      });
      Alert.alert(
        'Error',
        err?.message ?? 'Could not start subscription. Please try again.'
      );
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
      Alert.alert('Missing info', 'Please select both a date and a time window.');
      return;
    }
    if (!address) {
      Alert.alert(
        'Missing location',
        'Please add a pickup address before scheduling.'
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
        location: address,
        items,
        totalPrice,
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

      const message =
        (paymentError?.message as string | undefined)?.toLowerCase() ?? '';
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

  const handleContinue = () => {
    if (isSubscription) {
      handleStartSubscription();
      return;
    }
    handleConfirm();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.helpPill}
          onPress={handleHelp}
          accessibilityRole="button"
          accessibilityLabel="Help"
        >
          <Ionicons
            name="help-circle-outline"
            size={18}
            color={COLORS.textSecondary}
          />
          <AppText style={styles.helpPillText}>Help</AppText>
        </TouchableOpacity>
      </View>

      <View style={styles.titleBlock}>
        <AppText style={styles.title}>Schedule pickup</AppText>
        <AppText style={styles.subtitle}>
          Choose when you'd like us to collect your items
        </AppText>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContent>
          <View style={styles.segmentTrack}>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                bookingType === 'one_off' && styles.segmentButtonActive,
              ]}
              onPress={() => {
                setBookingType('one_off');
                trackEvent('payment_plan_selected', {
                  screen: SCREEN,
                  type: 'one_off',
                });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: bookingType === 'one_off' }}
            >
              <AppText
                style={[
                  styles.segmentText,
                  bookingType === 'one_off' && styles.segmentTextActive,
                ]}
              >
                One-off
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentButton,
                bookingType === 'subscription' && styles.segmentButtonActive,
              ]}
              onPress={() => {
                setBookingType('subscription');
                trackEvent('payment_plan_selected', {
                  screen: SCREEN,
                  type: 'subscription',
                });
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: bookingType === 'subscription' }}
            >
              <AppText
                style={[
                  styles.segmentText,
                  bookingType === 'subscription' && styles.segmentTextActive,
                ]}
              >
                Subscription
              </AppText>
            </TouchableOpacity>
          </View>

          {isSubscription ? (
            <>
              <AppText style={styles.sectionLabel}>Collection frequency</AppText>
              <View style={styles.frequencyList}>
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
                        styles.frequencyCard,
                        isSelected && styles.frequencyCardSelected,
                      ]}
                      onPress={() => setIntervalWeeks(opt.intervalWeeks)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={styles.frequencyTitleRow}>
                        <AppText
                          style={[
                            styles.frequencyTitle,
                            isSelected && styles.frequencyTitleSelected,
                          ]}
                        >
                          {opt.title}
                        </AppText>
                        <View style={styles.frequencyBadge}>
                          <AppText style={styles.frequencyBadgeText}>
                            {formatSubscriptionDiscountBadge(opt.frequency)}
                          </AppText>
                        </View>
                      </View>
                      <AppText style={styles.frequencyDetail}>
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
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : null}

          <AppText style={styles.sectionLabel}>First collection</AppText>
          <TouchableOpacity
            style={[styles.card, styles.dateCard]}
            onPress={() => setShowCalendar(true)}
            accessibilityRole="button"
            accessibilityLabel="Change collection date"
          >
            <View style={styles.dateIconWrap}>
              <Ionicons name="calendar-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.dateCopy}>
              <AppText style={styles.dateTitle}>
                {formatLongDate(selectedDate)}
              </AppText>
              <AppText style={styles.dateHint}>Tap to change date</AppText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>
          {isSubscription && collectionDayKey ? (
            <AppText style={styles.collectionHelperText}>
              {subscriptionRecurringHelperCopy(
                intervalWeeks,
                formatDayLabel(collectionDayKey)
              )}
            </AppText>
          ) : null}

          <SubscriptionCollectionCalendarModal
            visible={showCalendar}
            onClose={() => setShowCalendar(false)}
            minimumDate={minimumPickupCalendarDate}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            title={isSubscription ? 'First collection date' : 'Pickup date'}
            subtitle={
              isSubscription
                ? 'Pick a day for your first pickup. Recurring pickups follow this day of the week.'
                : "Choose when you'd like your pickup. Past dates and the next two days are not available."
            }
          />

          {!isSubscription ? (
            <>
              <AppText style={styles.sectionLabel}>Time window</AppText>
              <View style={styles.timeWindowBlock}>
                <TimeWindowPicker
                  selectedWindowId={selectedWindowId}
                  onSelect={setSelectedWindowId}
                />
              </View>
            </>
          ) : null}

          <AppText style={styles.sectionLabel}>Pickup summary</AppText>
          <View style={styles.card}>
            {items.map((item) => (
              <View key={item.id ?? item.type} style={styles.summaryRow}>
                <View style={styles.summaryIconWrap}>
                  <Ionicons
                    name={itemIcon(item)}
                    size={18}
                    color={COLORS.primary}
                  />
                </View>
                <AppText style={styles.summaryItemLabel}>
                  {item.type} × {item.quantity}
                </AppText>
                <AppText style={styles.summaryItemPrice}>
                  {formatPrice(item.totalPrice)}
                </AppText>
              </View>
            ))}
            <View style={styles.summaryDivider} />
            <View style={styles.summaryTotalRow}>
              <AppText style={styles.summaryTotalLabel}>Total</AppText>
              {isSubscription ? (
                <View style={styles.summaryTotalAmounts}>
                  <AppText style={styles.summaryOriginalValue}>
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
            {isSubscription && savings > 0 ? (
              <AppText style={styles.summarySavingsText}>
                You’re saving {formatPrice(savings)} with a{' '}
                {selectedSubscriptionDiscountPercent}% subscription discount.
              </AppText>
            ) : null}
          </View>

          {!hasItems ? (
            <View style={styles.noItemsNotice}>
              <AppText style={styles.noItemsText}>
                No bins selected. Please go back and add bins before confirming.
              </AppText>
            </View>
          ) : null}

          <AppText style={styles.sectionLabel}>Pickup address</AppText>
          <View style={[styles.card, styles.addressCard]}>
            <View style={styles.dateIconWrap}>
              <Ionicons name="location-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.addressCopy}>
              {address ? (
                <AppText style={styles.addressText}>{address}</AppText>
              ) : (
                <AppText style={styles.addressMissing}>
                  Add a pickup address to continue
                </AppText>
              )}
            </View>
            <TouchableOpacity
              style={styles.changeLink}
              onPress={handleChangeAddress}
              accessibilityRole="button"
              accessibilityLabel="Change pickup address"
            >
              <AppText style={styles.changeLinkText}>Change</AppText>
              <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <AppText style={styles.sectionLabel}>Payment method</AppText>
          <View style={styles.paymentRow}>
            <View
              style={[styles.paymentCard, styles.paymentCardSelected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: true }}
              accessibilityLabel="Mobile Money"
            >
              <View style={styles.paymentCardHeader}>
                <View style={styles.paymentIconWrap}>
                  <Ionicons name="phone-portrait-outline" size={18} color={COLORS.primary} />
                </View>
                <View style={[styles.paymentRadio, styles.paymentRadioSelected]}>
                  <Ionicons name="checkmark" size={12} color={COLORS.white} />
                </View>
              </View>
              <AppText style={styles.paymentTitle}>Mobile Money</AppText>
              <AppText style={styles.paymentSubtitle}>
                Pay with MTN, Telecel or AirtelTigo.
              </AppText>
            </View>

            <View
              style={[styles.paymentCard, styles.paymentCardDisabled]}
              accessibilityRole="radio"
              accessibilityState={{ disabled: true }}
              accessibilityLabel="Card, coming soon"
            >
              {/* FOLLOW-UP: When Stripe goes live, enable Card here AND on CartScreen
                  (store checkout). Both currently show Card as disabled "Coming soon". */}
              <View style={styles.paymentCardHeader}>
                <View style={styles.paymentIconWrap}>
                  <Ionicons
                    name="card-outline"
                    size={18}
                    color={COLORS.textSecondary}
                  />
                </View>
                <View style={styles.paymentRadio} />
              </View>
              <AppText style={styles.paymentTitle}>Card</AppText>
              <AppText style={styles.paymentSubtitle}>
                Visa, Mastercard or other cards
              </AppText>
              <View style={styles.comingSoon}>
                <AppText style={styles.comingSoonText}>Coming soon</AppText>
              </View>
            </View>
          </View>
        </ResponsiveContent>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View>
          <AppText style={styles.totalLabel}>Total</AppText>
          <AppText style={styles.totalValue}>{formatPrice(displayTotal)}</AppText>
        </View>
        <TouchableOpacity
          style={[
            styles.continueButton,
            !canContinue && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canContinue }}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <AppText style={styles.continueButtonText}>
                Continue to Payment
              </AppText>
              <Ionicons name="arrow-forward" size={16} color={COLORS.white} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
