import React from 'react';
import {
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { COLORS } from '@/lib/constants';
import { styles } from './app-text-input.styles';

interface AppTextInputProps extends TextInputProps {
  containerStyle?: ViewStyle;
}

export const AppTextInput: React.FC<AppTextInputProps> = ({
  containerStyle,
  style,
  ...props
}) => {
  return (
    <View style={[styles.container, containerStyle]}>
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
};
