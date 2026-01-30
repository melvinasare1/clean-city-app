import { StyleSheet, Platform } from "react-native";
import { COLORS, VARS } from "@/lib/constants";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: VARS.medium,
    paddingBottom: VARS.xlarge,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: VARS.medium,
    paddingTop: VARS.small,
    paddingBottom: VARS.small,
  },
  headerSide: {
    width: 40,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  headerSideRight: {
    width: 40,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.text,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: COLORS.text,
  },

  heroCard: {
    borderRadius: VARS.large,
    overflow: "hidden",
    marginTop: VARS.medium,
    marginBottom: VARS.medium,
  },
  heroBackground: {
    paddingHorizontal: VARS.medium,
    paddingVertical: VARS.large,
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  heroInnerOverlay: {
    flex: 1,
    borderRadius: VARS.large,
    paddingHorizontal: VARS.medium,
    paddingVertical: VARS.large,
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.white,
    lineHeight: 34,
  },
  heroSubtitle: {
    marginTop: VARS.small,
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9,
  },

  descriptionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: VARS.medium,
  },

  referralCard: {
    backgroundColor: COLORS.white,
    borderRadius: VARS.medium,
    padding: VARS.medium,
    marginBottom: VARS.medium,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 2,
  },
  referralCardLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: VARS.small,
    letterSpacing: 0.5,
  },
  referralInner: {
    borderRadius: VARS.medium,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.secondary,
    paddingHorizontal: VARS.small,
    paddingVertical: VARS.small,
    flexDirection: "row",
    alignItems: "center",
  },
  referralCodeWrapper: {
    flex: 1,
    paddingRight: VARS.small,
  },
  referralCodeText: {
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.text,
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: undefined,
    }),
  },
  referralCodeLine: {
    lineHeight: 24,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.primary,
    paddingHorizontal: VARS.small,
    paddingVertical: VARS.xxsmall,
    borderRadius: VARS.large,
  },
  copyButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 4,
  },

  shareSection: {
    marginTop: VARS.medium,
    marginBottom: VARS.medium,
  },
  shareTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: VARS.small,
  },
  shareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  shareItem: {
    flex: 1,
    alignItems: "center",
  },
  shareItemCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 1,
    marginBottom: VARS.xxsmall,
  },
  shareItemLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
  },

  referralsCard: {
    backgroundColor: "#E8F5E9",
    borderRadius: VARS.medium,
    padding: VARS.medium,
    marginTop: VARS.medium,
  },
  referralsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: VARS.small,
  },
  referralsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  referralsEarned: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.success,
  },
  progressBarBackground: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "#C8E6C9",
    overflow: "hidden",
    marginBottom: VARS.small,
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  referralsFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  referralsFooterText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: VARS.medium,
  },
  errorText: {
    color: COLORS.error,
    marginBottom: VARS.small,
    textAlign: "center",
  },
  disclaimerContainer: {
    marginTop: VARS.medium,
    marginBottom: VARS.medium,
    paddingHorizontal: VARS.medium,
  },
  disclaimerText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  disclaimerLink: {
    color: COLORS.primary,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
});
