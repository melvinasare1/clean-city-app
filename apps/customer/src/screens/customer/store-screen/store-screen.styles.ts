import { StyleSheet } from 'react-native';
import { colors, radius, spacing, typography } from '@platform/shared-theme';

const cardBorder = '#EEF1F4';
const pageBg = '#F7F8FA';

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceWhite,
  },
  scrollRoot: {
    flex: 1,
    backgroundColor: pageBg,
  },
  scrollInner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    marginLeft: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.brandGreen,
    letterSpacing: -0.4,
    lineHeight: 34,
    marginBottom: spacing.xs,
  },
  pageSubtitle: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkSecondary,
  },
  cartButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: cardBorder,
    backgroundColor: colors.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.signalRed,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    color: colors.surfaceWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  promoBanner: {
    backgroundColor: colors.brandGreen,
    borderRadius: radius.card,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  promoTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.surfaceWhite,
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  promoBody: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.brandGreenSoft,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  shopNowButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceWhite,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  shopNowText: {
    ...typography.button,
    fontSize: 14,
    color: colors.brandGreen,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.inkPrimary,
    marginBottom: spacing.md,
  },
  sectionBlock: {
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surfaceWhite,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: cardBorder,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
  },
  imageWrap: {
    width: 88,
    height: 88,
    borderRadius: 12,
    backgroundColor: colors.brandGreenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    width: 88,
    height: 88,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.inkPrimary,
    marginBottom: 4,
  },
  productDescription: {
    ...typography.body,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  price: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.brandGreen,
    marginBottom: spacing.sm,
  },
  addButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brandGreen,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  addButtonAdded: {
    backgroundColor: colors.inkCharcoal,
  },
  addButtonText: {
    ...typography.button,
    fontSize: 13,
    color: colors.surfaceWhite,
  },
  empty: {
    ...typography.body,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  loader: {
    marginVertical: spacing.lg,
  },
});
