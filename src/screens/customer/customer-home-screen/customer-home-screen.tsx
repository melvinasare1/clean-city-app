import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../../../hooks/useAuth';
import { styles } from './customer-home-screen.styles';
import { CustomerTabParamList } from '@/navigation/types';
import { AppText } from '@/components';

type CustomerHomeScreenProps = BottomTabScreenProps<
  CustomerTabParamList,
  'CustomerHome'
>;

export const CustomerHomeScreen: React.FC<CustomerHomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText style={styles.title}>Welcome back!</AppText>
        <AppText style={styles.subtitle}>{user?.email}</AppText>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <AppText style={styles.cardTitle}>Quick Actions</AppText>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('NewBooking')}
          >
            <AppText style={styles.actionButtonText}>📦 Schedule New Pickup</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => navigation.navigate('MyBookings')}
          >
            <AppText style={styles.actionButtonTextSecondary}>📋 View My Bookings</AppText>
          </TouchableOpacity>
        </View>

        {/* <View style={styles.card}>
          <AppText style={styles.cardTitle}>Recent Activity</AppText>
          <AppText style={styles.placeholderText}>
            Your recent bookings will appear here
          </AppText>
        </View> */}
      </View>
    </View>
  );
};
