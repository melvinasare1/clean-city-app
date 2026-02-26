import { COLORS, VARS } from "@/lib/constants";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: VARS.medium,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  title: {
    fontSize: VARS.medium + 2,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: VARS.small,
    textAlign: "center",
  },
  message: {
    fontSize: VARS.small,
    color: COLORS.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
  logoutButton: {
    marginTop: VARS.xlarge,
    paddingVertical: VARS.small,
    paddingHorizontal: VARS.medium,
  },
  logoutButtonText: {
    color: COLORS.error,
    fontSize: VARS.small,
    fontWeight: "600",
  },
});
