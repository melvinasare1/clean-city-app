import React from 'react';
import { View, ViewStyle, StyleProp } from 'react-native';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { styles } from './responsive-content.styles';

interface ResponsiveContentProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  innerStyle?: StyleProp<ViewStyle>;
  /** Skip max-width centering (e.g. full-bleed headers). */
  fullWidth?: boolean;
}

export const ResponsiveContent: React.FC<ResponsiveContentProps> = ({
  children,
  style,
  innerStyle,
  fullWidth = false,
}) => {
  const { contentStyle } = useResponsiveLayout();

  if (fullWidth) {
    return <View style={[styles.fullWidth, style]}>{children}</View>;
  }

  return (
    <View style={[styles.outer, style]}>
      <View style={[styles.inner, contentStyle, innerStyle]}>{children}</View>
    </View>
  );
};
