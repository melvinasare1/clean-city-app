// EXAMPLE UI CODE - Daily Reminder Settings Screen
// This is example code showing how to integrate daily reminders into a settings screen
// Copy and adapt this code into your actual settings screen component

import React, { useState, useEffect } from 'react';
import { View, Text, Switch, Button, StyleSheet, Alert } from 'react-native';
import { useAuthContext } from '@/contexts/auth-context';
import {
  enableDailyReminder,
  disableDailyReminder,
  getCurrentReminderSettings,
  enableWeeklyReminder,
  disableWeeklyReminder,
  getCurrentWeeklyReminderSettings,
  type ReminderSettings,
  type WeeklyReminderSettings,
} from '@/lib/reminders';

/**
 * Example Settings Screen Component
 * Shows how to toggle reminders and set time
 */
export const ReminderSettingsExample: React.FC = () => {
  const { user } = useAuthContext();
  const [enabled, setEnabled] = useState(false);
  const [hour, setHour] = useState(9); // Default 9 AM
  const [minute, setMinute] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Load current settings on mount
  useEffect(() => {
    if (!user?.id) return;

    const loadSettings = async () => {
      try {
        const settings = await getCurrentReminderSettings(user.id);
        if (settings) {
          setEnabled(settings.dailyEnabled);
          setHour(settings.hour);
          setMinute(settings.minute);
        }
      } catch (error) {
        console.error('Error loading reminder settings:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadSettings();
  }, [user?.id]);

  const handleToggle = async (value: boolean) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      if (value) {
        // Enable reminder with current time
        const notificationId = await enableDailyReminder(user.id, hour, minute);
        if (notificationId) {
          setEnabled(true);
          Alert.alert('Success', `Daily reminder enabled for ${formatTime(hour, minute)}`);
        } else {
          Alert.alert(
            'Error',
            'Failed to enable reminder. Please check notification permissions in Settings.'
          );
        }
      } else {
        // Disable reminder
        await disableDailyReminder(user.id);
        setEnabled(false);
        Alert.alert('Success', 'Daily reminder disabled');
      }
    } catch (error) {
      console.error('Error toggling reminder:', error);
      Alert.alert('Error', 'Failed to update reminder settings');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeChange = async (newHour: number, newMinute: number) => {
    if (!user?.id) return;

    setHour(newHour);
    setMinute(newMinute);

    // If reminder is enabled, reschedule with new time
    if (enabled) {
      setLoading(true);
      try {
        const notificationId = await enableDailyReminder(user.id, newHour, newMinute);
        if (notificationId) {
          Alert.alert('Success', `Reminder time updated to ${formatTime(newHour, newMinute)}`);
        } else {
          Alert.alert('Error', 'Failed to update reminder time');
        }
      } catch (error) {
        console.error('Error updating reminder time:', error);
        Alert.alert('Error', 'Failed to update reminder time');
      } finally {
        setLoading(false);
      }
    }
  };

  const formatTime = (h: number, m: number): string => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
  };

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Reminders</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Enable Daily Reminder</Text>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          disabled={loading || !user?.id}
        />
      </View>

      {enabled && (
        <View style={styles.timeContainer}>
          <Text style={styles.label}>Reminder Time</Text>
          <Text style={styles.timeDisplay}>{formatTime(hour, minute)}</Text>

          {/* Simple time picker buttons - replace with DateTimePicker in production */}
          <View style={styles.timeControls}>
            <Button
              title="9:00 AM"
              onPress={() => handleTimeChange(9, 0)}
              disabled={loading}
            />
            <Button
              title="12:00 PM"
              onPress={() => handleTimeChange(12, 0)}
              disabled={loading}
            />
            <Button
              title="6:00 PM"
              onPress={() => handleTimeChange(18, 0)}
              disabled={loading}
            />
          </View>

          <Text style={styles.hint}>
            Tip: Use @react-native-community/datetimepicker for a proper time picker
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
  },
  timeContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  timeDisplay: {
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 10,
    textAlign: 'center',
  },
  timeControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 10,
    textAlign: 'center',
  },
});

/**
 * Alternative: Simple hook for reminder settings
 * Use this in your existing settings screen
 */
export const useReminderSettings = () => {
  const { user } = useAuthContext();
  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      const current = await getCurrentReminderSettings(user.id);
      setSettings(current);
    };

    load();
  }, [user?.id]);

  const enable = async (hour: number, minute: number) => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const id = await enableDailyReminder(user.id, hour, minute);
      if (id) {
        const updated = await getCurrentReminderSettings(user.id);
        setSettings(updated);
      }
      return id;
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      await disableDailyReminder(user.id);
      const updated = await getCurrentReminderSettings(user.id);
      setSettings(updated);
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    loading,
    enable,
    disable,
    enabled: settings?.dailyEnabled ?? false,
  };
};

// ============================================================================
// WEEKLY REMINDER UI EXAMPLES (Rubbish Collection Reminders)
// ============================================================================

/**
 * Example Weekly Reminder Settings Screen Component
 * Shows how to toggle weekly reminders and set weekday/time
 */
export const WeeklyReminderSettingsExample: React.FC = () => {
  const { user } = useAuthContext();
  const [enabled, setEnabled] = useState(false);
  const [weekday, setWeekday] = useState(1); // Default Monday (1 = Monday, 7 = Sunday)
  const [hour, setHour] = useState(9); // Default 9 AM
  const [minute, setMinute] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Load current settings on mount
  useEffect(() => {
    if (!user?.id) return;

    const loadSettings = async () => {
      try {
        const settings = await getCurrentWeeklyReminderSettings(user.id);
        if (settings) {
          setEnabled(settings.weeklyEnabled);
          setWeekday(settings.weekday);
          setHour(settings.hour);
          setMinute(settings.minute);
        }
      } catch (error) {
        console.error('Error loading weekly reminder settings:', error);
      } finally {
        setInitialLoading(false);
      }
    };

    loadSettings();
  }, [user?.id]);

  const handleToggle = async (value: boolean) => {
    if (!user?.id) return;

    setLoading(true);
    try {
      if (value) {
        // Enable reminder with current weekday and time
        const notificationId = await enableWeeklyReminder(weekday, hour, minute);
        if (notificationId) {
          setEnabled(true);
          Alert.alert(
            'Success',
            `Weekly reminder enabled for ${weekdayNames[weekday - 1]} at ${formatTime(hour, minute)}`
          );
        } else {
          Alert.alert(
            'Error',
            'Failed to enable reminder. Please check notification permissions in Settings.'
          );
        }
      } else {
        // Disable reminder
        await disableWeeklyReminder();
        setEnabled(false);
        Alert.alert('Success', 'Weekly reminder disabled');
      }
    } catch (error) {
      console.error('Error toggling weekly reminder:', error);
      Alert.alert('Error', 'Failed to update reminder settings');
    } finally {
      setLoading(false);
    }
  };

  const handleWeekdayChange = async (newWeekday: number) => {
    if (!user?.id) return;

    setWeekday(newWeekday);

    // If reminder is enabled, reschedule with new weekday
    if (enabled) {
      setLoading(true);
      try {
        const notificationId = await enableWeeklyReminder(newWeekday, hour, minute);
        if (notificationId) {
          Alert.alert('Success', `Reminder day updated to ${weekdayNames[newWeekday - 1]}`);
        } else {
          Alert.alert('Error', 'Failed to update reminder day');
        }
      } catch (error) {
        console.error('Error updating reminder day:', error);
        Alert.alert('Error', 'Failed to update reminder day');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTimeChange = async (newHour: number, newMinute: number) => {
    if (!user?.id) return;

    setHour(newHour);
    setMinute(newMinute);

    // If reminder is enabled, reschedule with new time
    if (enabled) {
      setLoading(true);
      try {
        const notificationId = await enableWeeklyReminder(weekday, newHour, newMinute);
        if (notificationId) {
          Alert.alert('Success', `Reminder time updated to ${formatTime(newHour, newMinute)}`);
        } else {
          Alert.alert('Error', 'Failed to update reminder time');
        }
      } catch (error) {
        console.error('Error updating reminder time:', error);
        Alert.alert('Error', 'Failed to update reminder time');
      } finally {
        setLoading(false);
      }
    }
  };

  const formatTime = (h: number, m: number): string => {
    const period = h >= 12 ? 'PM' : 'AM';
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`;
  };

  if (initialLoading) {
    return (
      <View style={styles.container}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Weekly Rubbish Collection Reminders</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Enable Weekly Reminder</Text>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          disabled={loading || !user?.id}
        />
      </View>

      {enabled && (
        <>
          <View style={styles.timeContainer}>
            <Text style={styles.label}>Day of Week</Text>
            <Text style={styles.timeDisplay}>{weekdayNames[weekday - 1]}</Text>

            {/* Simple weekday picker buttons - replace with Picker in production */}
            <View style={styles.timeControls}>
              {weekdayNames.map((name, index) => (
                <Button
                  key={index}
                  title={name.substring(0, 3)}
                  onPress={() => handleWeekdayChange(index + 1)}
                  disabled={loading}
                />
              ))}
            </View>
          </View>

          <View style={styles.timeContainer}>
            <Text style={styles.label}>Reminder Time</Text>
            <Text style={styles.timeDisplay}>{formatTime(hour, minute)}</Text>

            {/* Simple time picker buttons - replace with DateTimePicker in production */}
            <View style={styles.timeControls}>
              <Button
                title="9:00 AM"
                onPress={() => handleTimeChange(9, 0)}
                disabled={loading}
              />
              <Button
                title="12:00 PM"
                onPress={() => handleTimeChange(12, 0)}
                disabled={loading}
              />
              <Button
                title="6:00 PM"
                onPress={() => handleTimeChange(18, 0)}
                disabled={loading}
              />
            </View>

            <Text style={styles.hint}>
              Tip: Use @react-native-community/datetimepicker for a proper time picker
            </Text>
          </View>
        </>
      )}
    </View>
  );
};

/**
 * Alternative: Simple hook for weekly reminder settings
 * Use this in your existing settings screen
 */
export const useWeeklyReminderSettings = () => {
  const { user } = useAuthContext();
  const [settings, setSettings] = useState<WeeklyReminderSettings | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      const current = await getCurrentWeeklyReminderSettings(user.id);
      setSettings(current);
    };

    load();
  }, [user?.id]);

  const enable = async (weekday: number, hour: number, minute: number) => {
    if (!user?.id) return null;

    setLoading(true);
    try {
      const id = await enableWeeklyReminder(weekday, hour, minute);
      if (id) {
        const updated = await getCurrentWeeklyReminderSettings(user.id);
        setSettings(updated);
      }
      return id;
    } finally {
      setLoading(false);
    }
  };

  const disable = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      await disableWeeklyReminder();
      const updated = await getCurrentWeeklyReminderSettings(user.id);
      setSettings(updated);
    } finally {
      setLoading(false);
    }
  };

  return {
    settings,
    loading,
    enable,
    disable,
    enabled: settings?.weeklyEnabled ?? false,
  };
};

