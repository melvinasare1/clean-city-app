import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Text,
  Switch,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import { isAdmin } from '@/lib/admin';
import type { AdminStackParamList } from '@/navigation/types';
import { sendPush, type PushNotificationResponse } from '@/lib/pushSender';
import { AppButton } from '@/components/app-button';
import { AppTextInput } from '@/components/app-text-input';
import { AppText } from '@/components/app-text';
import { COLORS } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { getApiBaseUrl } from '@/lib/apiBase';

type RecipientMode = 'single' | 'all';

interface SendResult {
  userId: string;
  success: boolean;
  error?: string;
  response?: PushNotificationResponse;
}

export const AdminPushScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AdminStackParamList, 'AdminPush'>>();
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('single');
  const [userSearch, setUserSearch] = useState('');
  const [userToken, setUserToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dataJson, setDataJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [allUsersCount, setAllUsersCount] = useState(0);
  const [showEnvVar, setShowEnvVar] = useState(false);
  const [testingBackend, setTestingBackend] = useState(false);
  const [backendTestResult, setBackendTestResult] = useState<string | null>(null);
  const [backendTestError, setBackendTestError] = useState<string | null>(null);

  // Check admin access
  useEffect(() => {
    if (!isAdmin(user)) {
      Alert.alert('Access Denied', 'Admin access required');
    }
  }, [user]);

  if (!isAdmin(user)) {
    return (
      <View style={styles.container}>
        <AppText style={styles.errorText}>Admin access required</AppText>
      </View>
    );
  }

  const loadUserToken = async () => {
    if (!userSearch.trim()) {
      Alert.alert('Error', 'Please enter a user UID or email');
      return;
    }

    setLoading(true);
    setUserToken(null);
    setUserEmail(null);

    try {
      // Try as UID first
      const userDoc = await getDoc(doc(db, 'profiles', userSearch.trim()));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const token = userData.expoPushToken;
        setUserToken(token || null);
        setUserEmail(userData.email || null);

        if (!token) {
          Alert.alert('No Token', 'User does not have a push token');
        }
        return;
      }

      // Try searching by email
      const profilesRef = collection(db, 'profiles');
      const emailQuery = query(profilesRef, where('email', '==', userSearch.trim().toLowerCase()));
      const emailSnapshot = await getDocs(emailQuery);

      if (!emailSnapshot.empty) {
        const userData = emailSnapshot.docs[0].data();
        const token = userData.expoPushToken;
        setUserToken(token || null);
        setUserEmail(userData.email || null);
        setUserSearch(emailSnapshot.docs[0].id); // Set to UID

        if (!token) {
          Alert.alert('No Token', 'User does not have a push token');
        }
        return;
      }

      Alert.alert('Not Found', 'User not found');
    } catch (error) {
      console.error('Error loading user token:', error);
      Alert.alert('Error', 'Failed to load user token');
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsersCount = async () => {
    if (recipientMode !== 'all') return;

    setLoading(true);
    try {
      const profilesRef = collection(db, 'profiles');
      const snapshot = await getDocs(profilesRef);

      const usersWithTokens = snapshot.docs.filter(
        (doc) => doc.data().expoPushToken
      );

      setAllUsersCount(usersWithTokens.length);
    } catch (error) {
      console.error('Error loading users count:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (recipientMode === 'all') {
      loadAllUsersCount();
    }
  }, [recipientMode]);

  const handleTestBackend = async () => {
    setTestingBackend(true);
    setBackendTestResult(null);
    setBackendTestError(null);

    try {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(`${baseUrl}/api/health`);
      const text = await response.text();

      if (!response.ok) {
        setBackendTestError(`Status ${response.status}: ${text}`);
        return;
      }

      try {
        const json = JSON.parse(text);
        setBackendTestResult(JSON.stringify(json, null, 2));
      } catch {
        // Not JSON, just show raw text
        setBackendTestResult(text);
      }
    } catch (error) {
      console.error('Error testing backend:', error);
      setBackendTestError(
        error instanceof Error ? error.message : 'Unknown error testing backend'
      );
    } finally {
      setTestingBackend(false);
    }
  };

  const parseDataJson = (): Record<string, any> | null => {
    if (!dataJson.trim()) {
      return {};
    }

    try {
      return JSON.parse(dataJson);
    } catch (error) {
      Alert.alert('Invalid JSON', 'Please enter valid JSON for data field');
      return null;
    }
  };

  const sendToSingleUser = async (): Promise<SendResult> => {
    if (!userToken) {
      return {
        userId: userSearch,
        success: false,
        error: 'No push token found',
      };
    }

    const data = parseDataJson();
    if (data === null) {
      return {
        userId: userSearch,
        success: false,
        error: 'Invalid JSON data',
      };
    }

    const response = await sendPush({
      to: userToken,
      title,
      body,
      data,
    });

    return {
      userId: userSearch,
      success: response.success,
      error: response.error,
      response,
    };
  };

  const sendToAllUsers = async (): Promise<SendResult[]> => {
    const results: SendResult[] = [];

    try {
      const profilesRef = collection(db, 'profiles');
      const snapshot = await getDocs(profilesRef);

      const usersWithTokens = snapshot.docs.filter(
        (doc) => doc.data().expoPushToken
      );

      const data = parseDataJson();
      if (data === null) {
        return [{
          userId: 'all',
          success: false,
          error: 'Invalid JSON data',
        }];
      }

      // Rate limit: send sequentially with small delay
      for (let i = 0; i < usersWithTokens.length; i++) {
        const userDoc = usersWithTokens[i];
        const userId = userDoc.id;
        const token = userDoc.data().expoPushToken;

        const response = await sendPush({
          to: token,
          title,
          body,
          data,
        });

        results.push({
          userId,
          success: response.success,
          error: response.error,
          response,
        });

        // Small delay between sends (100ms = ~10 per second)
        if (i < usersWithTokens.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } catch (error) {
      console.error('Error sending to all users:', error);
      results.push({
        userId: 'all',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return results;
  };

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Title and body are required');
      return;
    }

    if (recipientMode === 'single') {
      if (!userToken) {
        Alert.alert('Error', 'Please load user token first');
        return;
      }

      setSending(true);
      setResults([]);

      try {
        const result = await sendToSingleUser();
        setResults([result]);
      } catch (error) {
        console.error('Error sending notification:', error);
        Alert.alert('Error', 'Failed to send notification');
      } finally {
        setSending(false);
      }
    } else {
      // Bulk send with confirmation
      if (allUsersCount === 0) {
        Alert.alert('Error', 'No users with push tokens found');
        return;
      }

      Alert.alert(
        'Confirm Bulk Send',
        `Send notification to ${allUsersCount} users?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Send',
            onPress: async () => {
              setSending(true);
              setResults([]);

              try {
                const bulkResults = await sendToAllUsers();
                setResults(bulkResults);
              } catch (error) {
                console.error('Error sending bulk notifications:', error);
                Alert.alert('Error', 'Failed to send notifications');
              } finally {
                setSending(false);
              }
            },
          },
        ]
      );
    }
  };

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  const apiUrl = process.env.EXPO_PUBLIC_API_URL;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <AppButton
          title="Job assignment"
          onPress={() => navigation.navigate('AdminJobs')}
          variant="secondary"
          buttonStyle={styles.debugButton}
        />
      </View>
      {/* Debug Section */}
      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>Debug Info</AppText>
        <AppButton
          title={showEnvVar ? 'Hide API URL' : 'Show API URL'}
          onPress={() => setShowEnvVar(!showEnvVar)}
          variant="secondary"
          buttonStyle={styles.debugButton}
        />
        {showEnvVar && (
          <View style={styles.envVarContainer}>
            <AppText style={styles.envVarLabel}>EXPO_PUBLIC_API_URL:</AppText>
            <AppText style={styles.envVarValue}>
              {apiUrl || 'undefined'}
            </AppText>
            {!apiUrl && (
              <AppText style={styles.envVarWarning}>
                ⚠️ Environment variable is undefined! Check your .env file or app.json
              </AppText>
            )}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>Debug</AppText>
        <AppButton
          title={testingBackend ? 'Testing Backend...' : 'Test Backend'}
          onPress={handleTestBackend}
          disabled={testingBackend}
          buttonStyle={styles.sendButton}
        />
        {(backendTestResult || backendTestError) && (
          <View style={styles.debugResultContainer}>
            {backendTestResult && (
              <AppText style={styles.debugSuccessText}>{backendTestResult}</AppText>
            )}
            {backendTestError && (
              <AppText style={styles.debugErrorText}>{backendTestError}</AppText>
            )}
          </View>
        )}
      </View>
      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>Recipient</AppText>

        <View style={styles.switchContainer}>
          <AppText>Single User</AppText>
          <Switch
            value={recipientMode === 'all'}
            onValueChange={(value) => setRecipientMode(value ? 'all' : 'single')}
          />
          <AppText>All Users</AppText>
        </View>

        {recipientMode === 'single' ? (
          <View style={styles.singleUserContainer}>
            <AppTextInput
              placeholder="User UID or Email"
              value={userSearch}
              onChangeText={setUserSearch}
              style={styles.input}
            />
            <AppButton
              title={loading ? 'Loading...' : 'Load User Token'}
              onPress={loadUserToken}
              disabled={loading || !userSearch.trim()}
              loading={loading}
              buttonStyle={styles.button}
            />

            {userToken && (
              <View style={styles.tokenInfo}>
                <AppText style={styles.tokenLabel}>✓ Token found</AppText>
                {userEmail && (
                  <AppText style={styles.tokenEmail}>{userEmail}</AppText>
                )}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.allUsersContainer}>
            <AppText style={styles.countText}>
              {loading ? 'Loading...' : `${allUsersCount} users with push tokens`}
            </AppText>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle}>Notification</AppText>

        <AppTextInput
          placeholder="Title (required)"
          value={title}
          onChangeText={setTitle}
          style={styles.input}
        />

        <AppTextInput
          placeholder="Body (required)"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
          style={[styles.input, styles.textArea]}
        />

        <AppTextInput
          placeholder='Data (JSON, optional, e.g. {"type": "admin_notification"})'
          value={dataJson}
          onChangeText={setDataJson}
          multiline
          numberOfLines={3}
          style={[styles.input, styles.textArea]}
        />
      </View>

      <View style={styles.section}>
        <AppButton
          title={sending ? 'Sending...' : 'Send Notification'}
          onPress={handleSend}
          disabled={sending || !title.trim() || !body.trim()}
          loading={sending}
          buttonStyle={styles.sendButton}
        />
      </View>

      {results.length > 0 && (
        <View style={styles.section}>
          <AppText style={styles.sectionTitle}>Results</AppText>

          <View style={styles.resultsSummary}>
            <AppText style={styles.summaryText}>
              ✓ Success: {successCount}
            </AppText>
            <AppText style={styles.summaryText}>
              ✗ Failed: {failureCount}
            </AppText>
          </View>

          <ScrollView style={styles.resultsList}>
            {results.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                <AppText style={styles.resultUserId}>
                  {result.userId}
                </AppText>
                <AppText
                  style={[
                    styles.resultStatus,
                    result.success ? styles.resultSuccess : styles.resultError,
                  ]}
                >
                  {result.success ? '✓ Success' : `✗ ${result.error || 'Failed'}`}
                </AppText>
                {result.response?.message && (
                  <AppText style={styles.resultMessage}>
                    {result.response.message}
                  </AppText>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: COLORS.text,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  singleUserContainer: {
    gap: 12,
  },
  allUsersContainer: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 8,
  },
  countText: {
    fontSize: 16,
    color: COLORS.text,
  },
  input: {
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: 8,
  },
  sendButton: {
    marginTop: 8,
  },
  tokenInfo: {
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginTop: 8,
  },
  tokenLabel: {
    fontSize: 14,
    color: COLORS.success,
    fontWeight: '600',
  },
  tokenEmail: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  resultsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginBottom: 12,
  },
  summaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultsList: {
    maxHeight: 300,
  },
  resultItem: {
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginBottom: 8,
  },
  resultUserId: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  resultStatus: {
    fontSize: 14,
    marginBottom: 4,
  },
  resultSuccess: {
    color: COLORS.success,
  },
  resultError: {
    color: COLORS.error,
  },
  resultMessage: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 16,
    color: COLORS.error,
    textAlign: 'center',
    marginTop: 32,
  },
  debugButton: {
    marginBottom: 12,
  },
  envVarContainer: {
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    marginTop: 8,
  },
  envVarLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  envVarValue: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: COLORS.text,
    marginBottom: 8,
  },
  envVarWarning: {
    fontSize: 12,
    color: COLORS.error,
    fontStyle: 'italic',
  },
  debugResultContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.white,
    borderRadius: 8,
  },
  debugSuccessText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  debugErrorText: {
    fontSize: 12,
    color: COLORS.error,
  },
});

