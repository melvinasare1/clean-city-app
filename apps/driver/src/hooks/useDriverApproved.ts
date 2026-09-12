import { Alert } from "react-native";
import { useDriverStatus } from "@/contexts/driver-status-context";

export const PENDING_APPROVAL_MESSAGE =
  "Your driver profile is pending approval. You can browse the app, but features will be available once your account is approved.";

export function useDriverApproved(): {
  isApproved: boolean;
  showPendingAlert: () => void;
} {
  const { isApproved } = useDriverStatus();

  const showPendingAlert = () => {
    Alert.alert("Profile pending approval", PENDING_APPROVAL_MESSAGE);
  };

  return { isApproved, showPendingAlert };
}
