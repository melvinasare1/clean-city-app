import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';
import { COLORS } from '../../../lib/constants';

interface AppTextProps extends TextProps {
  variant?: 'default' | 'title' | 'subtitle' | 'caption';
  color?: string;
}

export const AppText: React.FC<AppTextProps> = ({
  variant = 'default',
  color = COLORS.text,
  style,
  children,
  ...props
}) => {
  return (
    <Text
      style={[
        styles.base,
        variant === 'title' && styles.title,
        variant === 'subtitle' && styles.subtitle,
        variant === 'caption' && styles.caption,
        { color },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
};

const styles = StyleSheet.create({
  base: {
    fontSize: 16,
    color: COLORS.text,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  caption: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
});

