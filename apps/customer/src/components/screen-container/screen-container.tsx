import React from 'react';
import {
  View,
  ViewStyle,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { styles } from './screen-container.styles';

interface ScreenContainerProps {
  children: React.ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
}

export const ScreenContainer: React.FC<ScreenContainerProps> = ({
  children,
  style,
  scrollable = false,
}) => {
  const { contentStyle } = useResponsiveLayout();

  const content = (
    <View style={[styles.outer, scrollable && styles.scrollOuter]}>
      <View
        style={[styles.container, contentStyle, style]}
        testID="screen-content-container"
      >
        {children}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {scrollable ? (
          <ScrollView
            testID="screen-scroll-view"
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {content}
          </ScrollView>
        ) : (
          content
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
