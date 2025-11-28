import React, { useState, useMemo } from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenContainer, AppText, AppButton } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { TIME_WINDOWS, TimeWindowId } from '@/lib/time-windows';
import { createBooking } from '@/services/bookingService';
import { CustomerStackParamList } from '@/navigation/types';
import { styles } from './create-booking-screen.styles';

type CreateBookingScreenProps = NativeStackScreenProps<
  CustomerStackParamList,
  'CreateBooking'
>;

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export const CreateBookingScreen: React.FC<CreateBookingScreenProps> = ({
  navigation,
}) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedWindowId, setSelectedWindowId] = useState<TimeWindowId | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

  const locationMissing = !user?.location;

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
    !user.location ||
    isSaving;

  const selectedWindowLabel = useMemo(() => {
    if (!selectedWindowId) {
      return null;
    }
    return TIME_WINDOWS.find((window) => window.id === selectedWindowId)?.label;
  }, [selectedWindowId]);

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

    try {
      setIsSaving(true);
      const dateStr = selectedDate.toISOString().slice(0, 10);
      await createBooking({
        userId: user.id,
        date: dateStr,
        windowId: selectedWindowId,
        location: user.location,
      });
      Alert.alert(
        'Booking scheduled',
        `Your ${selectedWindowLabel.toLowerCase()} pickup on ${formatDate(
          selectedDate
        )} has been scheduled.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error creating booking:', error);
      Alert.alert(
        'Error',
        'Could not schedule your pickup. Please try again shortly.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer scrollable>
      <View style={styles.form}>
        <AppText style={styles.title}>Schedule a pickup</AppText>
        <AppText style={styles.subtitle}>
          Choose a date and time window for your waste collection.
        </AppText>

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
          buttonStyle={[
            styles.confirmButton,
            (isConfirmDisabled || locationMissing) && styles.confirmButtonDisabled,
          ]}
          textStyle={styles.confirmButtonText}
        />
      </View>
    </ScreenContainer>
  );
};


