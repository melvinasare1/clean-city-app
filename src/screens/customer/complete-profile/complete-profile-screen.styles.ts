import { StyleSheet, Platform } from 'react-native';
import { COLORS, VARS } from '@/lib/constants';

const GREEN_LIGHT = '#E8F5E9';
const GREEN_BORDER = '#C8E6C9';
const GREEN_MUTED = '#66BB6A';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: VARS.xlarge,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: VARS.medium,
    paddingTop: VARS.small,
    marginBottom: VARS.medium,
  },
  headerMain: {
    flex: 1,
    paddingRight: VARS.small,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: VARS.medium,
  },
  unlockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingHorizontal: VARS.xsmall,
    paddingVertical: 6,
    gap: 4,
    alignSelf: 'flex-start',
  },
  unlockBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  checklist: {
    paddingHorizontal: VARS.medium,
    marginBottom: VARS.large,
    gap: VARS.xsmall,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VARS.xsmall,
  },
  checklistCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checklistCircleComplete: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  checklistText: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  checklistTextComplete: {
    color: COLORS.textSecondary,
    textDecorationLine: 'line-through',
  },
  form: {
    paddingHorizontal: VARS.medium,
    gap: VARS.small,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: VARS.xxsmall,
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
  referralCard: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: VARS.medium,
    padding: VARS.medium,
    marginTop: VARS.medium,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
  },
  referralHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VARS.xsmall,
    marginBottom: VARS.xxsmall,
  },
  referralIconBox: {
    width: 36,
    height: 36,
    borderRadius: VARS.xsmall,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
  },
  referralSubtext: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
    marginBottom: VARS.small,
    opacity: 0.85,
  },
  referralSubtextHighlight: {
    fontWeight: '700',
    color: COLORS.primary,
  },
  referralInput: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderRadius: VARS.xsmall,
    borderWidth: 1,
    borderColor: GREEN_BORDER,
    fontSize: 16,
    letterSpacing: 1,
    paddingVertical: VARS.small,
    paddingHorizontal: VARS.small,
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: undefined,
    }),
  },
  referralError: {
    fontSize: 13,
    color: COLORS.error,
    marginTop: VARS.xxsmall,
  },
  skipLink: {
    alignSelf: 'flex-end',
    marginTop: VARS.xxsmall,
    paddingVertical: 4,
  },
  skipLinkText: {
    fontSize: 13,
    color: GREEN_MUTED,
    fontWeight: '500',
  },
  saveButton: {
    marginTop: VARS.large,
    backgroundColor: COLORS.primary,
    paddingVertical: VARS.small + 2,
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
});
