import { StyleSheet } from "react-native";
import { COLORS, VARS } from "@/lib/constants";

export const styles = StyleSheet.create({
  form: {
    padding: VARS.medium,
    gap: VARS.small,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: VARS.small,
    lineHeight: 22,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderRadius: VARS.small,
    padding: VARS.medium,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: VARS.xsmall,
    color: COLORS.text,
  },
  summaryItem: {
    marginTop: VARS.xsmall,
  },
  summaryItemType: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
  summaryItemMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "#E0E0E0",
    marginVertical: VARS.small,
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryTotalLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.primary,
  },
  summaryOriginalValue: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textDecorationLine: "line-through",
  },
  summarySavingsText: {
    fontSize: 13,
    color: COLORS.primary,
  },
  noItemsNotice: {
    backgroundColor: "#FFF3E0",
    borderRadius: VARS.xsmall,
    padding: VARS.small,
  },
  noItemsText: {
    fontSize: 13,
    color: COLORS.accent,
    lineHeight: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: VARS.small,
  },
  dateSelector: {
    marginTop: VARS.xsmall,
    borderRadius: VARS.xsmall,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingVertical: VARS.small,
    paddingHorizontal: VARS.small,
    backgroundColor: COLORS.white,
  },
  dateSelectorText: {
    fontSize: 16,
    color: COLORS.text,
  },
  windowButtonsContainer: {
    marginTop: VARS.xsmall,
    gap: VARS.xsmall,
  },
  windowButton: {
    paddingVertical: VARS.small,
    paddingHorizontal: VARS.small,
    borderRadius: VARS.xsmall,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: COLORS.white,
  },
  windowButtonSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "#E8F5E9",
  },
  windowButtonText: {
    fontSize: 16,
    color: COLORS.text,
  },
  windowButtonTextSelected: {
    color: COLORS.primary,
    fontWeight: "600",
  },
  dayDropdown: {
    marginTop: VARS.xsmall,
    marginBottom: VARS.medium,
    borderRadius: VARS.xsmall,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingVertical: VARS.small,
    paddingHorizontal: VARS.small,
    backgroundColor: COLORS.white,
  },
  dayDropdownText: {
    fontSize: 16,
    color: COLORS.text,
  },
  dayDropdownPlaceholder: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  dayModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: VARS.medium,
  },
  dayModal: {
    width: "100%",
    maxHeight: "80%",
    backgroundColor: COLORS.white,
    borderRadius: VARS.small,
    padding: VARS.medium,
  },
  dayModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: VARS.small,
    color: COLORS.text,
  },
  dayOption: {
    paddingVertical: VARS.xsmall,
  },
  dayOptionText: {
    fontSize: 16,
    color: COLORS.text,
  },
  dayModalCancel: {
    marginTop: VARS.small,
    paddingVertical: VARS.xsmall,
    alignItems: "center",
  },
  dayModalCancelText: {
    fontSize: 16,
    color: COLORS.error,
    fontWeight: "600",
  },
  locationText: {
    fontSize: 16,
    color: COLORS.text,
    marginTop: VARS.xsmall,
  },
  locationWarningContainer: {
    backgroundColor: "#FFF3E0",
    borderRadius: VARS.xsmall,
    padding: VARS.small,
    marginTop: VARS.xsmall,
  },
  locationWarning: {
    fontSize: 14,
    color: COLORS.accent,
    marginBottom: VARS.xsmall,
  },
  completeProfileLink: {
    alignSelf: "flex-start",
  },
  completeProfileText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: "600",
  },
  confirmButton: {
    marginTop: VARS.medium,
    width: "100%",
  },
  confirmButtonDisabled: {
    opacity: 0.7,
  },
  confirmButtonText: {
    fontWeight: "600",
  },
});
