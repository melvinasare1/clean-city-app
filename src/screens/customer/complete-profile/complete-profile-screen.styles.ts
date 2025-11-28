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
  description: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: VARS.small,
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  input: {
    fontSize: 16,
  },
  selectInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: VARS.xsmall,
    paddingVertical: VARS.xsmall,
    paddingHorizontal: VARS.small,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
  },
  selectText: {
    fontSize: 16,
    color: COLORS.text,
  },
  selectPlaceholder: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  helperText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  areaModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: VARS.medium,
  },
  areaModal: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: COLORS.white,
    borderRadius: VARS.small,
    padding: VARS.medium,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: VARS.small,
    color: COLORS.text,
  },
  areaOption: {
    paddingVertical: VARS.xsmall,
  },
  areaOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  modalCancel: {
    marginTop: VARS.small,
    paddingVertical: VARS.xsmall,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: COLORS.error,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: VARS.medium,
    backgroundColor: COLORS.primary,
    paddingVertical: VARS.small,
    borderRadius: VARS.xsmall,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});


