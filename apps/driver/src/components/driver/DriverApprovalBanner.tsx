import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, VARS } from "@/lib/constants";

export const DriverApprovalBanner: React.FC = () => (
  <View style={styles.banner}>
    <Text style={styles.title}>Profile pending approval</Text>
    <Text style={styles.message}>
      You can explore the driver app, but features will stay disabled until your
      profile is approved. We will email you with next steps.
    </Text>
  </View>
);

const styles = StyleSheet.create({
  banner: {
    backgroundColor: COLORS.amberLight,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.amberMuted,
    paddingHorizontal: VARS.small,
    paddingVertical: VARS.xsmall,
  },
  title: {
    fontSize: VARS.xsmall + 2,
    fontWeight: "700",
    color: COLORS.amberDark,
    marginBottom: 4,
  },
  message: {
    fontSize: VARS.xsmall,
    color: COLORS.amberDark,
    lineHeight: 18,
  },
});
