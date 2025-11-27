
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../../hooks/useAuth';
import { styles } from './driver-home-screen.styles';

type DriverStackParamList = {
  DriverHome: undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
};

type DriverHomeScreenProps = {
  navigation: NativeStackNavigationProp<DriverStackParamList, 'DriverHome'>;
};

export const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ navigation }) => {
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
        <Text style={styles.title}>Driver Dashboard</Text>
        <Text style={styles.subtitle}>{user?.email}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>5</Text>
            <Text style={styles.statLabel}>Today's Jobs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>$425</Text>
            <Text style={styles.statLabel}>Today's Earnings</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Actions</Text>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('DriverJobList')}
          >
            <Text style={styles.actionButtonText}>📋 View All Jobs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => {
              // TODO: Navigate to available jobs
            }}
          >
            <Text style={styles.actionButtonTextSecondary}>🔍 Find Available Jobs</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Today's Schedule</Text>
          <Text style={styles.placeholderText}>
            Your assigned jobs for today will appear here
          </Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};
