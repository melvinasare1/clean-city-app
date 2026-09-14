import { StyleSheet } from "react-native";
import { colors, radius, spacing, typography } from "@platform/shared-theme";

export const SCREEN_PADDING_H = spacing.md;

const awaitingBg = "#FFF6E5";
const awaitingText = "#C47A12";
const cancelledBg = "#FDECEA";
const segmentTrack = "#EEF1F4";

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfaceWhite,
  },
  scrollRoot: {
    flex: 1,
    backgroundColor: colors.surfaceWhite,
  },
  scrollInner: {
    paddingHorizontal: SCREEN_PADDING_H,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  pageHeaderBlock: {
    marginBottom: spacing.lg,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
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
  segmentTrack: {
    flexDirection: "row",
    backgroundColor: segmentTrack,
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: spacing.xl,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentTabActive: {
    backgroundColor: colors.brandGreen,
  },
  segmentTabLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSecondary,
  },
  segmentTabLabelActive: {
    color: colors.surfaceWhite,
  },
  sectionBlock: {
    marginBottom: spacing.xl,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.inkPrimary,
  },
  viewAllRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.brandGreen,
  },
  card: {
    backgroundColor: colors.surfaceWhite,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: radius.card,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: "#EEF1F4",
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardTouchable: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.brandGreenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.inkPrimary,
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    flexShrink: 0,
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
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.inkSecondary,
  },
  emptyCard: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  emptyText: {
    ...typography.body,
    textAlign: "center",
  },
  loadingState: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
  },
  errorState: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
  errorText: {
    ...typography.body,
    color: colors.signalRed,
    textAlign: "center",
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.brandGreen,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
  },
  retryButtonText: {
    ...typography.button,
    color: colors.surfaceWhite,
    fontSize: 14,
  },
  listHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    minHeight: 44,
  },
  listHeaderBack: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  listHeaderTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: colors.inkPrimary,
  },
  listHeaderSpacer: {
    width: 40,
  },
  listBody: {
    flex: 1,
    paddingHorizontal: SCREEN_PADDING_H,
  },
  listScrollInner: {
    paddingBottom: spacing.xl,
  },
});
