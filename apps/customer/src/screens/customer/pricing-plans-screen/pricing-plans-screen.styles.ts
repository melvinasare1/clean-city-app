import { StyleSheet } from 'react-native';
import { COLORS, VARS } from '@/lib/constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: VARS.small,
    paddingBottom: VARS.xlarge,
  },
  intro: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: VARS.small,
  },
  loader: {
    marginTop: VARS.large,
  },
  empty: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: VARS.small,
    marginBottom: VARS.xsmall,
    flexDirection: 'row',
    alignItems: 'center',
    gap: VARS.small,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  binName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  binDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
