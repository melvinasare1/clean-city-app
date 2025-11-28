
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS } from '../../../lib/constants';
import { styles } from './driver-job-list-screen.styles';

type DriverStackParamList = {
  DriverHome: undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
};

type DriverJobListScreenProps = {
  navigation: NativeStackNavigationProp<DriverStackParamList, 'DriverJobList'>;
};

export const DriverJobListScreen: React.FC<DriverJobListScreenProps> = ({ navigation }) => {
  // TODO: Fetch jobs from Firestore
  // const { user } = useAuth();
  // useEffect(() => {
  //   // Query Firestore for bookings where driverId === user.id
  // }, []);

  // Placeholder data for UI design
  const mockJobs = [
    {
      id: '1',
      address: '123 Main St',
      timeWindow: 'morning',
      status: 'assigned',
      earnings: 85,
    },
    {
      id: '2',
      address: '456 Oak Ave',
      timeWindow: 'afternoon',
      status: 'in_progress',
      earnings: 120,
    },
    {
      id: '3',
      address: '789 Pine Rd',
      timeWindow: 'evening',
      status: 'assigned',
      earnings: 60,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned':
        return '#2196F3';
      case 'in_progress':
        return '#FF9800';
      case 'completed':
        return COLORS.success;
      default:
        return COLORS.textSecondary;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Assigned Jobs</Text>

        {mockJobs.map((job) => (
          <TouchableOpacity
            key={job.id}
            style={styles.card}
            onPress={() => navigation.navigate('DriverJobDetail', { jobId: job.id })}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardAddress}>📍 {job.address}</Text>
              <View
                style={[
                  styles.statusBadge,
                  { backgroundColor: getStatusColor(job.status) },
                ]}
              >
                <Text style={styles.statusText}>
                  {job.status.replace('_', ' ').toUpperCase()}
                </Text>
              </View>
            </View>

            <View style={styles.cardDetails}>
              <Text style={styles.cardTime}>
                ⏰ {job.timeWindow.charAt(0).toUpperCase() + job.timeWindow.slice(1)}
              </Text>
              <Text style={styles.cardEarnings}>💰 GHS {job.earnings}</Text>
            </View>

            <Text style={styles.cardNote}>Tap to view details</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.placeholderCard}>
          <Text style={styles.placeholderText}>
            📱 Jobs will be loaded from Firestore in the next phase
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};