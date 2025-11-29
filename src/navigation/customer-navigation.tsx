
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomerHomeScreen } from '../screens/customer/customer-home-screen/customer-home-screen';
import { NewBookingScreen } from '../screens/customer/new-booking-screen/new-booking-screen';
import { MyBookingsScreen } from '../screens/customer/my-bookings/my-bookings-screen';
import { CompleteProfileScreen } from '../screens/customer/complete-profile/complete-profile-screen';
import { CreateBookingScreen } from '../screens/customer/create-booking/create-booking-screen';
import { COLORS } from '../lib/constants';
import {
    CustomerStackParamList,
    CustomerTabParamList,
} from './types';

const Stack = createNativeStackNavigator<CustomerStackParamList>();
const Tab = createBottomTabNavigator<CustomerTabParamList>();

const TabIcon: React.FC<{ icon: string; color: string }> = ({ icon }) => (
    <>{icon}</>
);

const CustomerTabs = () => (
    <Tab.Navigator
        screenOptions={{
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textSecondary,
            tabBarStyle: {
                backgroundColor: COLORS.white,
                borderTopWidth: 1,
                borderTopColor: '#E0E0E0',
            },
            headerStyle: {
                backgroundColor: COLORS.primary,
            },
            headerTintColor: COLORS.white,
            headerTitleStyle: {
                fontWeight: '600',
            },
        }}
    >
        <Tab.Screen
            name="CustomerHome"
            component={CustomerHomeScreen}
            options={{
                title: 'Home',
                tabBarLabel: 'Home',
                tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} />,
                headerShown: false,
            }}
        />
        <Tab.Screen
            name="NewBooking"
            component={NewBookingScreen}
            options={{
                title: 'New Booking',
                tabBarLabel: 'New Booking',
                tabBarIcon: ({ color }) => <TabIcon icon="📦" color={color} />,
            }}
        />
        <Tab.Screen
            name="MyBookings"
            component={MyBookingsScreen}
            options={{
                title: 'My Bookings',
                tabBarLabel: 'My Bookings',
                tabBarIcon: ({ color }) => <TabIcon icon="📋" color={color} />,
            }}
        />
    </Tab.Navigator>
);

export const CustomerNavigator: React.FC = () => {
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
            }}
        >
            <Stack.Screen
                name="CustomerTabs"
                component={CustomerTabs}
                options={{ headerShown: false }}
            />
            <Stack.Screen
                name="CreateBooking"
                component={CreateBookingScreen}
                options={{ title: 'Schedule Pickup' }}
            />
            <Stack.Screen
                name="CompleteProfile"
                component={CompleteProfileScreen}
                options={{ title: 'Complete Profile' }}
            />
        </Stack.Navigator>
    );
};
