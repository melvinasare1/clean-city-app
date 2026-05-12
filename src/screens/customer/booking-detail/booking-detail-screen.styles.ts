import { StyleSheet } from "react-native";
import { COLORS, VARS } from "@/lib/constants";
import { MY_BOOKINGS_PAGE_BG } from "../my-bookings/my-bookings-screen.utils";

export const SCREEN_PADDING_H = 16;

/** Upcoming collection banner (design). */
export const UPCOMING_BANNER_BG = "#1B5E20";

export const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: MY_BOOKINGS_PAGE_BG,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING_H,
    paddingTop: 16,
    paddingBottom: VARS.xlarge,
  },
  scrollMuted: {
    opacity: 0.72,
  },

  /* Payment alert (unpaid confirmation style) */
  paymentAlert: {
    backgroundColor: "#FFF5F5",
    borderRadius: VARS.small,
    borderLeftWidth: 5,
    borderLeftColor: "#C62828",
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  paymentAlertIconOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#C62828",
    alignItems: "center",
    justifyContent: "center",
  },
  paymentAlertIconText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "900",
    marginTop: -1,
  },
  paymentAlertTextCol: {
    flex: 1,
    minWidth: 0,
  },
  paymentAlertTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#B71C1C",
    marginBottom: 6,
  },
  paymentAlertBody: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    color: "#C62828",
  },

  /* Title + status below native header */
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.3,
    lineHeight: 28,
    marginBottom: 10,
  },
  statusPillRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    paddingRight: 14,
    borderRadius: 20,
    gap: 8,
    marginBottom: 20,
  },
  statusPillIconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  statusPillIcon: {
    fontSize: 12,
    fontWeight: "900",
    color: "#C62828",
    marginTop: -1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: 0.6,
  },

  detailCardsStack: {
    gap: 10,
    marginBottom: 12,
  },
  detailMiniCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.white,
    borderRadius: VARS.small,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  detailMiniIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(102, 187, 106, 0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  detailMiniTextCol: {
    flex: 1,
    minWidth: 0,
  },
  detailMiniLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: "500",
  },
  detailMiniValue: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.2,
  },

  twoColRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
  },
  twoColCell: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: "500",
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    lineHeight: 20,
  },
  fullWidthBlock: {
    marginTop: 2,
  },
  paymentLastPaymentBlock: {
    marginTop: 12,
  },

  /* Next collection banner */
  upcomingBanner: {
    backgroundColor: UPCOMING_BANNER_BG,
    borderRadius: VARS.small,
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 14,
    overflow: "hidden",
    position: "relative",
  },
  upcomingBannerWatermark: {
    position: "absolute",
    left: -8,
    right: -8,
    top: -12,
    bottom: -12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignContent: "center",
    opacity: 0.1,
  },
  upcomingBannerWatermarkChar: {
    fontSize: 34,
    color: COLORS.white,
    marginHorizontal: 6,
    marginVertical: 4,
  },
  upcomingBannerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  upcomingBannerIconBox: {
    width: 44,
    height: 44,
    borderRadius: VARS.xsmall,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingBannerTextCol: {
    flex: 1,
    minWidth: 0,
  },
  upcomingBannerLabelCaps: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(200, 230, 201, 0.95)",
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  upcomingBannerDate: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: -0.3,
  },
  upcomingBannerDateMuted: {
    fontSize: 17,
    fontWeight: "700",
    color: "rgba(255,255,255,0.88)",
  },
  upcomingArrivingBadge: {
    alignSelf: "flex-start",
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  upcomingArrivingBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.white,
  },

  /* Payment summary card */
  paymentCard: {
    backgroundColor: COLORS.white,
    borderRadius: VARS.small,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  paymentSummaryTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 14,
  },
  paymentLineRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  paymentLineLeft: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    flex: 1,
  },
  paymentLineStrike: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  discountPctPill: {
    backgroundColor: "#C8E6C9",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  discountPctPillText: {
    fontSize: 11,
    fontWeight: "900",
    color: COLORS.primary,
    letterSpacing: 0.3,
  },
  discountSavings: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.success,
  },
  paymentDividerDotted: {
    borderStyle: "dotted",
    borderBottomWidth: 1,
    borderColor: "#BDBDBD",
    marginVertical: 4,
    marginBottom: 14,
  },
  paymentTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 8,
  },
  paymentTotalLeftBlock: {
    flex: 1,
    minWidth: 0,
  },
  paymentTotalLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
    fontWeight: "500",
  },
  paymentTotalAmount: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  paymentMetaRight: {
    alignItems: "flex-end",
    maxWidth: "46%",
  },
  paymentMetaSmall: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "500",
    textAlign: "right",
  },
  paymentMetaSmallTight: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: "500",
    textAlign: "right",
    marginTop: 2,
  },
  capsLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },

  /* Actions — no card */
  actionsBlock: {
    marginTop: 8,
    marginBottom: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: VARS.medium,
    borderRadius: VARS.xsmall,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: VARS.medium,
    borderRadius: VARS.xsmall,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 16,
  },
  dangerOutlineButton: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.white,
  },
  dangerOutlineText: {
    color: COLORS.error,
  },

  /* Support — tappable row */
  supportCard: {
    backgroundColor: "#E8ECE9",
    borderRadius: VARS.small,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 8,
    marginBottom: 8,
  },
  supportRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  supportRowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  supportRowTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 3,
  },
  supportRowSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },

  cancelNote: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: VARS.small,
    marginBottom: 8,
  },
  notFound: {
    paddingHorizontal: SCREEN_PADDING_H,
    paddingVertical: VARS.large,
    alignItems: "center",
    backgroundColor: MY_BOOKINGS_PAGE_BG,
    flex: 1,
  },
  notFoundText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
});

export const headerDotsStyle = StyleSheet.create({
  btn: {
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.white,
  },
});
