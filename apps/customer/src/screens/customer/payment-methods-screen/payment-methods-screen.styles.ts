import { StyleSheet } from 'react-native';
import { COLORS, VARS } from '@/lib/constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: VARS.medium,
    margin: VARS.small,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: VARS.small,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: VARS.xsmall,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: VARS.xsmall,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: VARS.xsmall,
  },
  currencyChip: {
    borderWidth: 1,
    borderColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
  },
  currencyChipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  currencyChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  currencyChipTextSelected: {
    color: COLORS.white,
  },
});
