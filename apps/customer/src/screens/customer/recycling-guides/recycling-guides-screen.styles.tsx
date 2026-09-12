import { StyleSheet } from 'react-native';
import { COLORS, VARS } from '@/lib/constants';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  contentContainer: {
    flexGrow: 1,
    paddingBottom: VARS.large,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageContainer: {
    alignItems: 'center',
    marginTop: VARS.xxlarge,
    marginBottom: VARS.large,
  },
  imagePlaceholder: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePlaceholderText: {
    fontSize: 72,
  },
  content: {
    paddingHorizontal: VARS.medium,
  },
  title: {
    fontSize: VARS.medium,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: VARS.small,
  },
  description: {
    fontSize: VARS.small,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: VARS.medium,
    marginBottom: VARS.large,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.background,
    borderRadius: VARS.xsmall - 4,
    padding: VARS.small,
    marginBottom: VARS.medium,
  },
  toggleLabel: {
    fontSize: VARS.small,
    color: COLORS.text,
    fontWeight: '500',
  },
  primaryButton: {
    marginBottom: VARS.small,
  },
  secondaryButton: {
    padding: VARS.small,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: VARS.small,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  successBadge: {
    backgroundColor: COLORS.success,
    borderRadius: VARS.xsmall - 4,
    paddingVertical: VARS.xsmall,
    paddingHorizontal: VARS.small,
    alignSelf: 'center',
    marginBottom: VARS.small,
  },
  successBadgeText: {
    color: COLORS.white,
    fontSize: VARS.small,
    fontWeight: '600',
  },
  bottomButtonContainer: {
    marginTop: 'auto',
    paddingHorizontal: VARS.medium,
    paddingBottom: VARS.small,
  },
});
