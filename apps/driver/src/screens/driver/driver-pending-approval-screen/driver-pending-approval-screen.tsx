import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/hooks/useAuth";
import { openDeleteAccountSupport } from "@/lib/delete-account";
import { styles } from "./driver-pending-approval-screen.styles";

export const DriverPendingApprovalScreen: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Account Under Review</Text>
        <Text style={styles.message}>
          Your driver account is currently under review. We will notify you once
          onboarding is complete.
        </Text>
        <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={() => openDeleteAccountSupport(user?.id, logout)}
        >
          <Text style={styles.logoutButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};
