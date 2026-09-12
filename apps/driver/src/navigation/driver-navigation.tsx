
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Feather from '@expo/vector-icons/Feather';
import { colors } from '@platform/shared-theme';
import { DriverHomeScreen } from '../screens/driver/driver-home-screen/driver-home-screen';
import { DriverJobListScreen } from '../screens/driver/driver-job-list-screen/driver-job-list-screen';
import { DriverJobDetailScreen } from '../screens/driver/driver-job-details-screen/driver-job-details-screen';
import { DailyEarningsDetailsScreen } from '../screens/driver/daily-earnings-details-screen/daily-earnings-details-screen';
import { MessagesScreen } from '../screens/driver/messages-screen/messages-screen';
import { DriverProfileScreen } from '../screens/driver/driver-profile-screen/driver-profile-screen';
import { COLORS } from '../lib/constants';
import type { DriverStackParamList, DriverTabParamList } from './types';

const Stack = createNativeStackNavigator<DriverStackParamList>();
const Tab = createBottomTabNavigator<DriverTabParamList>();

const DriverTabs: React.FC = () => {
    return (
        <Tab.Navigator
            detachInactiveScreens={false}
            screenOptions={{
                headerShown: false,
                unmountOnBlur: false,
                freezeOnBlur: false,
                tabBarActiveTintColor: colors.inkPrimary,
                tabBarInactiveTintColor: colors.inkSecondary,
                tabBarLabelStyle: {
                    fontSize: 11,
                    fontWeight: '500',
                },
                tabBarStyle: {
                    backgroundColor: colors.surfaceWhite,
                    borderTopWidth: 0.5,
                    borderTopColor: colors.surfaceMutedIcon,
                    elevation: 0,
                    shadowOpacity: 0,
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
                name="DailyEarningsDetails"
                component={DailyEarningsDetailsScreen}
                options={{
                    headerShown: false,
                }}
            />
        </Stack.Navigator>
    );
};
