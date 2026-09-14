import { StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "@platform/shared-theme";

export const SCREEN_PADDING_H = spacing.md;

const awaitingBg = "#FFF6E5";
const awaitingText = "#C47A12";
const cancelledBg = "#FDECEA";
const cardBorder = "#EEF1F4";
const softGreenFill = "#E8F5E9";

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceWhite,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    minHeight: 44,
    backgroundColor: colors.surfaceWhite,
  },
  headerSide: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  overflowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cardBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWhite,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.inkPrimary,
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "transparent",
  },
  menuCard: {
    position: "absolute",
    top: 52,
    right: spacing.md,
    minWidth: 200,
    backgroundColor: colors.surfaceWhite,
    borderRadius: 12,
    paddingVertical: 6,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    borderWidth: 1,
    borderColor: cardBorder,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkPrimary,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: cardBorder,
    marginHorizontal: 12,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.surfaceWhite,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING_H,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceWhite,
    borderRadius: radius.card,
    padding: 14,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: cardBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  typeIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.brandGreenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  typeMain: {
    flex: 1,
    minWidth: 0,
  },
  typeTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.inkPrimary,
    marginBottom: 8,
  },
  pill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  pillPaid: {
    backgroundColor: colors.brandGreenSoft,
  },
  pillAwaiting: {
    backgroundColor: awaitingBg,
  },
  pillCancelled: {
    backgroundColor: cancelledBg,
  },
  pillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  pillTextPaid: {
    color: colors.brandGreen,
  },
  pillTextAwaiting: {
    color: awaitingText,
  },
  pillTextCancelled: {
    color: colors.signalRed,
  },
  infoCard: {
    backgroundColor: colors.surfaceWhite,
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: cardBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  collectionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.inkSecondary,
    marginBottom: 2,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.inkPrimary,
  },
  rowValueMuted: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.inkSecondary,
  },
  addressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  changeLink: {
    paddingVertical: 2,
    paddingLeft: 8,
  },
  changeLinkText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.brandGreen,
  },
  addressValue: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkPrimary,
    lineHeight: 20,
    marginTop: 2,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.inkPrimary,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: colors.inkPrimary,
    paddingRight: 12,
  },
  itemQty: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.inkPrimary,
  },
  paymentLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  paymentLineLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: colors.inkSecondary,
  },
  paymentLineValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.inkPrimary,
  },
  actionsBlock: {
    marginTop: spacing.md,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginBottom: 10,
  },
  ctaPrimary: {
    backgroundColor: colors.brandGreen,
  },
  ctaSecondary: {
    backgroundColor: colors.surfaceWhite,
    borderWidth: 1.5,
    borderColor: colors.brandGreen,
  },
  ctaSoft: {
    backgroundColor: softGreenFill,
  },
  ctaDanger: {
    backgroundColor: colors.surfaceWhite,
    borderWidth: 1.5,
    borderColor: colors.signalRed,
  },
  ctaPrimaryText: {
    ...typography.button,
    color: colors.surfaceWhite,
  },
  ctaSecondaryText: {
    ...typography.button,
    color: colors.brandGreen,
  },
  ctaDangerText: {
    ...typography.button,
    color: colors.signalRed,
  },
  notFound: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING_H,
    paddingVertical: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWhite,
  },
  notFoundText: {
    ...typography.body,
    textAlign: "center",
  },
});
