import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';

type Props = {
  expectedLabel: string;
};

export function WrongAppScreen({ expectedLabel }: Props) {
  const { logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Wrong app</Text>
      <Text style={styles.body}>
        This account is not a {expectedLabel} account. Log out and open the matching Clean City
        app.
      </Text>
      <TouchableOpacity style={styles.button} onPress={() => void logout()}>
        <Text style={styles.buttonLabel}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  body: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 24,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonLabel: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
