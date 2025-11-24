import React from 'react';
import {
  TextInput,
  TextInputProps,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { COLORS, VARS } from '../../lib/constants';

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
        {...props}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: VARS.small,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: COLORS.text,
  },
});

