import { Alert, Linking } from 'react-native';
import { getDeleteAccountWhatsAppUrl } from '@/config/support';

export async function openDeleteAccountSupport(
  userId: string | undefined,
  logout?: () => Promise<void>
): Promise<void> {
  if (!userId) {
    Alert.alert(
      'Unable to delete account',
      'We could not find your user ID. Please log in and try again.'
    );
    return;
  }

  const url = getDeleteAccountWhatsAppUrl(userId);
  try {
    await Linking.openURL(url);
    if (logout) {
      await logout();
    }
  } catch (err) {
    console.warn('Failed to open WhatsApp for account deletion', err);
    Alert.alert(
      'Could not open WhatsApp',
      'Please contact support on WhatsApp and include your user ID.'
    );
  }
}
