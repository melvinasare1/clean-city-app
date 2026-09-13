import { COLORS, VARS } from '@/lib/constants';
import { StyleSheet } from 'react-native';

const CARD_RADIUS = 20;
const ICON_CIRCLE = 40;

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: VARS.xlarge,
  },
  content: {
    paddingHorizontal: VARS.small,
    paddingTop: VARS.xsmall,
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: VARS.xsmall,
  },
  greeting: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: VARS.small,
  },
  avatarButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  avatarInitials: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  locationPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: VARS.xsmall,
    gap: 6,
    marginBottom: VARS.small,
  },
  locationText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  profileBanner: {
    backgroundColor: '#E8F5E9',
    borderRadius: CARD_RADIUS,
    padding: VARS.medium,
    marginBottom: VARS.small,
  },
  profileBannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: VARS.small,
    marginBottom: VARS.small,
  },
  profileBannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  profileBannerIcon: {
    width: ICON_CIRCLE,
    height: ICON_CIRCLE,
    borderRadius: ICON_CIRCLE / 2,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  profileBannerSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    flexShrink: 1,
  },
  profileProgressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  profileProgressLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.success,
  },
  profileProgressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#C8E6C9',
    overflow: 'hidden',
  },
  profileProgressBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 3,
  },
  bookCard: {
    backgroundColor: COLORS.white,
    borderRadius: CARD_RADIUS,
    padding: VARS.small,
    marginBottom: VARS.medium,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: 148,
    borderRadius: 16,
    marginBottom: VARS.small,
    backgroundColor: COLORS.background,
  },
  bookCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: VARS.small,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  bookCardCopy: {
    flex: 1,
    minWidth: 0,
  },
  bookCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  bookCardSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 16,
    minWidth: 88,
    alignItems: 'center',
  },
  bookButtonMuted: {
    opacity: 0.55,
  },
  bookButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: VARS.xsmall,
  },
  nextCard: {
    backgroundColor: COLORS.white,
    borderRadius: CARD_RADIUS,
    padding: VARS.small,
    marginBottom: VARS.medium,
  },
  nextInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: VARS.small,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    padding: VARS.small,
  },
  nextIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextCopy: {
    flex: 1,
    minWidth: 0,
  },
  nextHeadline: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  nextWaste: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  emptyNext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  actionsList: {
    gap: VARS.xsmall,
  },
  actionRow: {
    backgroundColor: COLORS.white,
    borderRadius: CARD_RADIUS,
    paddingVertical: VARS.small,
    paddingHorizontal: VARS.small,
    flexDirection: 'row',
    alignItems: 'center',
    gap: VARS.small,
  },
  actionRowDisabled: {
    opacity: 0.45,
  },
  actionIconCircle: {
    width: ICON_CIRCLE,
    height: ICON_CIRCLE,
    borderRadius: ICON_CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconTeal: {
    backgroundColor: '#E8F5E9',
  },
  actionIconAmber: {
    backgroundColor: COLORS.amberLight,
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
});
