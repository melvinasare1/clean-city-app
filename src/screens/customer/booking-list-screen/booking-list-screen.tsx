
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { COLORS } from '../../../lib/constants';
import { styles } from './booking-list-screen.styles';

export const BookingListScreen: React.FC = () => {
  // TODO: Fetch bookings from Firestore
  // const { user } = useAuth();
  // useEffect(() => {
  //   // Query Firestore for bookings where customerId === user.id
  // }, []);

  // Placeholder data for UI design
  const mockBookings = [
    {
      id: '1',
      date: 'Nov 25, 2025',
      status: 'pending',
      total: 125,
    },
    {
      id: '2',
      date: 'Nov 20, 2025',
      status: 'completed',
      total: 100,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return COLORS.accent;
      case 'assigned':
        return '#2196F3';
      case 'in_progress':
        return '#FF9800';
      case 'completed':
        return COLORS.success;
      case 'cancelled':
        return COLORS.error;
      default:
        return COLORS.textSecondary;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>My Bookings</Text>

        {mockBookings.map((booking) => (
          <TouchableOpacity key={booking.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardDate}>{booking.date}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(booking.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {booking.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.cardPrice}>Total: ${booking.total}</Text>
            <Text style={styles.cardNote}>Tap to view details (coming soon)</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>
            📱 Bookings will be loaded from Firestore in the next phase
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};
