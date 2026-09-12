import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './messages-screen.styles';

export const MessagesScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No messages yet</Text>
      </View>
    </SafeAreaView>
  );
};
