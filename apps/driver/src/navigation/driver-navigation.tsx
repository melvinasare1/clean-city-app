
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@platform/shared-theme';
import { DriverHomeScreen } from '../screens/driver/driver-home-screen/driver-home-screen';
import { DriverJobListScreen } from '../screens/driver/driver-job-list-screen/driver-job-list-screen';
import { DriverJobDetailScreen } from '../screens/driver/driver-job-details-screen/driver-job-details-screen';
import { DailyEarningsDetailsScreen } from '../screens/driver/daily-earnings-details-screen/daily-earnings-details-screen';
import { MessagesScreen } from '../screens/driver/messages-screen/messages-screen';
import { DriverProfileScreen } from '../screens/driver/driver-profile-screen/driver-profile-screen';
import { ComingSoonScreen } from '../screens/driver/coming-soon-screen/coming-soon-screen';
import { SettingsScreen } from '../screens/driver/settings-screen/settings-screen';
import { JobSheetScreen } from '../screens/driver/job-sheet-screen/job-sheet-screen';
import { BackgroundLocationConsentScreen } from '../screens/driver/background-location-consent-screen';
import { COLORS } from '../lib/constants';
import type { DriverStackParamList, DriverTabParamList } from './types';

const Stack = createNativeStackNavigator<DriverStackParamList>();
const Tab = createBottomTabNavigator<DriverTabParamList>();

const TAB_BAR_CONTENT_HEIGHT = 56;

const DriverTabs: React.FC = () => {
    const insets = useSafeAreaInsets();
    const bottomInset = Math.max(insets.bottom, 8);

    return (
        <Tab.Navigator
            detachInactiveScreens={false}
            screenOptions={{
                headerShown: false,
                unmountOnBlur: false,
                freezeOnBlur: false,
                tabBarHideOnKeyboard: true,
                tabBarActiveTintColor: colors.brandGreen,
                tabBarInactiveTintColor: colors.inkSecondary,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '500',
                    marginBottom: 2,
                },
                tabBarStyle: {
                    backgroundColor: colors.surfaceWhite,
                    borderTopWidth: 0.5,
                    borderTopColor: colors.surfaceMutedIcon,
                    elevation: 12,
                    shadowColor: colors.shadow,
                    shadowOpacity: 1,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: -2 },
                    height: TAB_BAR_CONTENT_HEIGHT + bottomInset,
                    paddingTop: 6,
                    paddingBottom: bottomInset,
                },
            }}
        >
            <Tab.Screen
                name="Orders"
                component={DriverHomeScreen}
                options={{
                    tabBarLabel: 'Orders',
                    tabBarIcon: ({ color }) => (
                        <Feather name="box" size={24} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Earnings"
                component={DailyEarningsDetailsScreen}
                options={{
                    tabBarLabel: 'Earnings',
                    tabBarIcon: ({ color }) => (
                        <Feather name="bar-chart-2" size={24} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Messages"
                component={MessagesScreen}
                options={{
                    tabBarLabel: 'Messages',
                    tabBarIcon: ({ color }) => (
                        <Feather name="message-square" size={24} color={color} />
                    ),
                }}
            />
            <Tab.Screen
                name="Profile"
                component={DriverProfileScreen}
                options={{
                    tabBarLabel: 'Profile',
                    tabBarIcon: ({ color }) => (
                        <Feather name="user" size={24} color={color} />
                    ),
                }}
            />
        </Tab.Navigator>
    );
};

export const DriverNavigator: React.FC = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerStyle: {
                    backgroundColor: COLORS.primary,
                },
                headerTintColor: COLORS.white,
                headerTitleStyle: {
                    fontWeight: '600',
                },
                headerBackTitleVisible: false,
                headerBackButtonDisplayMode: 'minimal',
            }}
        >
            <Stack.Screen
                name="DriverTabs"
                component={DriverTabs}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="DriverJobList"
                component={DriverJobListScreen}
                options={{
                    title: 'My Jobs',
                }}
            />
            <Stack.Screen
                name="DriverJobDetail"
                component={DriverJobDetailScreen}
                options={{
                    title: 'Job Details',
                }}
            />
            <Stack.Screen
                name="JobSheet"
                component={JobSheetScreen}
                options={{
                    headerShown: false,
                    title: 'Job details',
                }}
            />
            <Stack.Screen
                name="DailyEarningsDetails"
                component={DailyEarningsDetailsScreen}
                options={{
                    headerShown: false,
                }}
            />
            <Stack.Screen
                name="ServiceProvider"
                component={ComingSoonScreen}
                options={{ title: 'Service provider' }}
            />
            <Stack.Screen
                name="PaymentMethod"
                component={ComingSoonScreen}
                options={{ title: 'Payment method' }}
            />
            <Stack.Screen
                name="Troubleshooting"
                component={ComingSoonScreen}
                options={{ title: 'Troubleshooting' }}
            />
            <Stack.Screen
                name="PhotoCheck"
                component={ComingSoonScreen}
                options={{ title: 'Photo check' }}
            />
            <Stack.Screen
                name="Settings"
                component={SettingsScreen}
                options={{ title: 'Settings' }}
            />
            <Stack.Screen
                name="Payouts"
                component={ComingSoonScreen}
                options={{ title: 'Payouts' }}
            />
            <Stack.Screen
                name="BackgroundLocationConsent"
                component={BackgroundLocationConsentScreen}
                options={{
                    title: 'Location sharing',
                    headerStyle: { backgroundColor: colors.surfaceWhite },
                    headerTintColor: colors.inkPrimary,
                }}
            />
        </Stack.Navigator>
    );
};
