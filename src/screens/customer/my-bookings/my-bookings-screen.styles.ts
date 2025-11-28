import { StyleSheet } from 'react-native';
import { COLORS, VARS } from '@/lib/constants';

export const styles = StyleSheet.create({
  content: {
    padding: VARS.medium,
    gap: VARS.small,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: VARS.small,
    color: COLORS.text,
  },
  profileBanner: {
    backgroundColor: COLORS.white,
    padding: VARS.medium,
    borderRadius: VARS.small,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: VARS.small,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: VARS.xsmall,
    color: COLORS.primary,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    padding: VARS.medium,
    borderRadius: VARS.small,
    marginBottom: VARS.small,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: VARS.xsmall,
  },
  cardDate: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  cardNote: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  placeholderCard: {
    backgroundColor: '#F0F4F8',
    padding: VARS.medium,
    borderRadius: VARS.small,
    marginTop: VARS.medium,
  },
  placeholderText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});


