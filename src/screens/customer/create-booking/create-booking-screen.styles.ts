import { StyleSheet } from 'react-native';
import { COLORS, VARS } from '@/lib/constants';

export const styles = StyleSheet.create({
  form: {
    padding: VARS.medium,
    gap: VARS.small,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: VARS.small,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: VARS.small,
  },
  dateSelector: {
    marginTop: VARS.xsmall,
    borderRadius: VARS.xsmall,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    paddingVertical: VARS.small,
    paddingHorizontal: VARS.small,
    backgroundColor: COLORS.white,
  },
  dateSelectorText: {
    fontSize: 16,
    color: COLORS.text,
  },
  windowButtonsContainer: {
    marginTop: VARS.xsmall,
    gap: VARS.xsmall,
  },
  windowButton: {
    paddingVertical: VARS.small,
    paddingHorizontal: VARS.small,
    borderRadius: VARS.xsmall,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: COLORS.white,
  },
  windowButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#E8F5E9',
  },
  windowButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  windowButtonTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  locationText: {
    fontSize: 16,
    color: COLORS.text,
    marginTop: VARS.xsmall,
  },
  locationWarningContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: VARS.xsmall,
    padding: VARS.small,
    marginTop: VARS.xsmall,
  },
  locationWarning: {
    fontSize: 14,
    color: COLORS.accent,
    marginBottom: VARS.xsmall,
  },
  completeProfileLink: {
    alignSelf: 'flex-start',
  },
  completeProfileText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
  confirmButton: {
    marginTop: VARS.medium,
    width: '100%',
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    fontWeight: '600',
  },
});


