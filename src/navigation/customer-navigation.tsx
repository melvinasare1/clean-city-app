
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CustomerHomeScreen } from '../screens/customer/customer-home-screen/customer-home-screen';
import { NewBookingScreen } from '../screens/customer/new-booking-screen/new-booking-screen';
import { BookingListScreen } from '../screens/customer/booking-list-screen/booking-list-screen';
import { COLORS } from '../lib/constants';

export type CustomerTabParamList = {
    CustomerHome: undefined;
    NewBooking: undefined;
    BookingList: undefined;
};

const Tab = createBottomTabNavigator<CustomerTabParamList>();

export const CustomerNavigator: React.FC = () => {
    return (
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
                name="BookingList"
                component={BookingListScreen}
                options={{
                    title: 'My Bookings',
                    tabBarLabel: 'My Bookings',
                    tabBarIcon: ({ color }) => <TabIcon icon="📋" color={color} />,
                }}
            />
        </Tab.Navigator>
    );
};
// Simple icon component using emoji
const TabIcon: React.FC<{ icon: string; color: string }> = ({ icon }) => {
    return <>{icon}</>;
};


