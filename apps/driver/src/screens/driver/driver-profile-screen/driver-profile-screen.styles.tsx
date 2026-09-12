import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@platform/shared-theme';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceWhite,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  headerCopy: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  title: {
    ...typography.headline,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    ...typography.body,
    marginTop: 4,
  },
  profileCard: {
    backgroundColor: colors.brandGreenSoft,
    borderRadius: radius.card,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarWrap: {
    width: 72,
    height: 72,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 72,
    height: 72,
  },
  profileCopy: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  name: {
    ...typography.headline,
    fontSize: 18,
  },
  roleLabel: {
    ...typography.body,
    marginTop: 2,
  },
  vehicleLine: {
    ...typography.statusSubtext,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceWhite,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    color: colors.brandGreen,
    fontSize: 12,
    fontWeight: '700',
  },
  statsCard: {
    marginTop: spacing.md,
    backgroundColor: colors.surfaceWhite,
    borderRadius: radius.card,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  statText: {
    alignItems: 'flex-start',
  },
  statValue: {
    color: colors.inkPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    ...typography.earningsLabel,
    fontWeight: '500',
    marginTop: 1,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: colors.surfaceMutedIcon,
  },
  list: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceWhite,
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMutedIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
  },
  rowLabel: {
    color: colors.inkPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  rowSubtitle: {
    ...typography.statusSubtext,
    marginTop: 2,
  },
  destructiveLabel: {
    color: colors.signalRed,
  },
});
