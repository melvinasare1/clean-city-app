import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@platform/shared-theme';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: colors.brandGreen,
    fontSize: 22,
    fontWeight: '700',
  },
  headerCopy: {
    flex: 1,
  },
  name: {
    ...typography.headline,
    fontSize: 20,
  },
  email: {
    ...typography.body,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceMutedIcon,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMutedIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    color: colors.inkPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveLabel: {
    color: colors.signalRed,
  },
});
