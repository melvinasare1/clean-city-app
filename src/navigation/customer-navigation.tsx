
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CustomerHomeScreen } from '../screens/customer/customer-home-screen/customer-home-screen';
import { NewBookingScreen } from '../screens/customer/new-booking-screen/new-booking-screen';
import { MyBookingsScreen } from '../screens/customer/my-bookings/my-bookings-screen';
import { CompleteProfileScreen } from '../screens/customer/complete-profile/complete-profile-screen';
import { CreateBookingScreen } from '../screens/customer/create-booking/create-booking-screen';
import { PaymentCallbackScreen } from '../screens/customer/payment/payment-callback-screen';
import { PrivacyPolicyScreen } from '../screens/privacy-policy/privacy-policy-screen';
import { ReferralProgramScreen } from "@/screens/referral/referral-program-screen";
import { COLORS } from '../lib/constants';

import {
    CustomerStackParamList,
    CustomerTabParamList,
} from './types';
import { IconsComponent } from '@/components';

const Stack = createNativeStackNavigator<CustomerStackParamList>();
const Tab = createBottomTabNavigator<CustomerTabParamList>();

type TabIconProps = {
    Icon: React.FC<React.SVGProps<SVGSVGElement>>;
    color?: string;
    size?: number;
};

const TabIcon: React.FC<TabIconProps> = ({
    Icon,
    color = "currentColor",
    size = 24,
}) => {
    return <Icon width={size} height={size} fill={color} />;
};

export default TabIcon;

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
                tabBarIcon: () => <IconsComponent name='HomeIcon' />,
                headerShown: false,
            }}
        />
        <Tab.Screen
            name="NewBooking"
            component={NewBookingScreen}
            options={{
                title: 'New Booking',
                tabBarLabel: 'New Booking',
                tabBarIcon: () => <IconsComponent name='DeliveryIcon' />,
            }}
        />
        <Tab.Screen
            name="MyBookings"
            component={MyBookingsScreen}
            options={{
                title: 'My Bookings',
                tabBarLabel: 'My Bookings',
                tabBarIcon: () => <IconsComponent name='BookingIcon' />,
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
            <Stack.Screen
                name="PaymentCallback"
                component={PaymentCallbackScreen}
                options={{ title: 'Payment Status' }}
            />
            <Stack.Screen
                name="PrivacyPolicy"
                component={PrivacyPolicyScreen}
                options={{ title: 'Privacy Policy' }}
            />
            <Stack.Screen
              name="ReferralProgram"
              component={ReferralProgramScreen}
              options={{ headerShown: false }}
            />
        </Stack.Navigator>
    );
};
