import React from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from './coming-soon-screen.styles';

export const ComingSoonScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Coming soon</Text>
      </View>
    </SafeAreaView>
  );
};
