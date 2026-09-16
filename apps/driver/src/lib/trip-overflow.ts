import { ActionSheetIOS, Alert, Linking, Platform } from 'react-native';

export const CANCEL_TRIP_CONFIRM_COPY =
  'Cancelling will reduce your priority by 10. Frequent cancellations can lead to account suspension.';

const SUPPORT_WHATSAPP_NUMBER = '233247014479';

export function openWhatsAppSupport(jobId?: string) {
  const message = jobId
    ? `Hi, I need help with job ${jobId}.`
    : 'Hi, I need help.';
  void Linking.openURL(
    `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`
  );
}

export function callCustomer(phone?: string | null) {
  const tel = phone?.trim();
  if (!tel) {
    Alert.alert('No phone number', 'This job does not have a customer phone number.');
    return;
  }
  void Linking.openURL(`tel:${tel}`);
}

export function confirmCancelTrip(onCancel: () => void, labels?: { title?: string; confirm?: string }) {
  Alert.alert(labels?.title ?? 'Cancel this trip?', CANCEL_TRIP_CONFIRM_COPY, [
    { text: 'Keep trip', style: 'cancel' },
    { text: labels?.confirm ?? 'Cancel trip', style: 'destructive', onPress: onCancel },
  ]);
}

type OverflowOptions = {
  phone?: string | null;
  jobId?: string;
  onCancel: () => void;
  cancelTitle?: string;
  cancelConfirmLabel?: string;
  getHelpLabel?: string;
  cancelMenuLabel?: string;
};

export function openTripOverflowMenu({
  phone,
  jobId,
  onCancel,
  cancelTitle,
  cancelConfirmLabel,
  getHelpLabel = 'Get help',
  cancelMenuLabel = 'Cancel trip',
}: OverflowOptions) {
  const runCancel = () =>
    confirmCancelTrip(onCancel, { title: cancelTitle, confirm: cancelConfirmLabel });

  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [getHelpLabel, 'Contact Customer', cancelMenuLabel, 'Close'],
        destructiveButtonIndex: 2,
        cancelButtonIndex: 3,
      },
      (buttonIndex) => {
        if (buttonIndex === 0) openWhatsAppSupport(jobId);
        if (buttonIndex === 1) callCustomer(phone);
        if (buttonIndex === 2) runCancel();
      }
    );
    return;
  }

  Alert.alert('Trip options', undefined, [
    { text: getHelpLabel, onPress: () => openWhatsAppSupport(jobId) },
    { text: 'Contact Customer', onPress: () => callCustomer(phone) },
    { text: cancelMenuLabel, style: 'destructive', onPress: runCancel },
    { text: 'Close', style: 'cancel' },
  ]);
}
