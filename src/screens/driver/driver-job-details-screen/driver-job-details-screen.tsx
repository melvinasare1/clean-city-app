
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { styles } from './driver-job-details-screen.styles';

type DriverStackParamList = {
  DriverHome: undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
};

type DriverJobDetailScreenProps = {
  navigation: NativeStackNavigationProp<DriverStackParamList, 'DriverJobDetail'>;
  route: RouteProp<DriverStackParamList, 'DriverJobDetail'>;
};

export const DriverJobDetailScreen: React.FC<DriverJobDetailScreenProps> = ({ route }) => {
  const { jobId } = route.params;

  // TODO: Fetch job details from Firestore using jobId
  // const [job, setJob] = useState<Booking | null>(null);

  // Placeholder data
  const mockJob = {
    id: jobId,
    address: '123 Main St, Apartment 4B',
    timeWindow: 'morning',
    status: 'assigned',
    earnings: 85,
    customerName: 'John Doe',
    customerPhone: '+1234567890',
    bins: {
      smallBags: 2,
      largeBags: 1,
      standardBins: 0,
      wheelieBins: 0,
    },
    notes: 'Please call when arriving',
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Job Details</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>
              {mockJob.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📍 Pickup Location</Text>
          <Text style={styles.address}>{mockJob.address}</Text>
          <Text style={styles.timeWindow}>
            ⏰ {mockJob.timeWindow.charAt(0).toUpperCase() + mockJob.timeWindow.slice(1)} (8:00 AM - 12:00 PM)
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>👤 Customer Information</Text>
          <Text style={styles.infoText}>Name: {mockJob.customerName}</Text>
          <Text style={styles.infoText}>Phone: {mockJob.customerPhone}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>🗑️ Items to Collect</Text>
          {mockJob.bins.smallBags > 0 && (
            <Text style={styles.binItem}>• Small Bags: {mockJob.bins.smallBags}</Text>
          )}
          {mockJob.bins.largeBags > 0 && (
            <Text style={styles.binItem}>• Large Bags: {mockJob.bins.largeBags}</Text>
          )}
          {mockJob.bins.standardBins > 0 && (
            <Text style={styles.binItem}>• Standard Bins: {mockJob.bins.standardBins}</Text>
          )}
          {mockJob.bins.wheelieBins > 0 && (
            <Text style={styles.binItem}>• Wheelie Bins: {mockJob.bins.wheelieBins}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💰 Earnings</Text>
          <Text style={styles.earnings}>${mockJob.earnings}</Text>
        </View>

        {mockJob.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>📝 Special Notes</Text>
            <Text style={styles.notes}>{mockJob.notes}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>Start Job</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButtonSecondary}>
          <Text style={styles.actionButtonTextSecondary}>Call Customer</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButtonSecondary}>
          <Text style={styles.actionButtonTextSecondary}>Get Directions</Text>
        </TouchableOpacity>

        <Text style={styles.placeholderText}>
          Actions will update job status in Firestore in the next phase
        </Text>
      </View>
    </ScrollView>
  );
};
