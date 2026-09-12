import { StyleSheet } from 'react-native';
import { colors, typography } from '@platform/shared-theme';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceWhite,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    ...typography.body,
    color: colors.inkSecondary,
    fontSize: 16,
    textAlign: 'center',
  },
});
