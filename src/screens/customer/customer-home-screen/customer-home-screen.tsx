import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../../hooks/useAuth';
import { styles } from './customer-home-screen.styles';

type CustomerStackParamList = {
  CustomerHome: undefined;
  NewBooking: undefined;
  BookingList: undefined;
};

type CustomerHomeScreenProps = {
  navigation: NativeStackNavigationProp<CustomerStackParamList, 'CustomerHome'>;
};

export const CustomerHomeScreen: React.FC<CustomerHomeScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back!</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('NewBooking')}
          >
            <Text style={styles.actionButtonText}>📦 Schedule New Pickup</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => navigation.navigate('BookingList')}
          >
            <Text style={styles.actionButtonTextSecondary}>📋 View My Bookings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Activity</Text>
          <Text style={styles.placeholderText}>
            Your recent bookings will appear here
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
