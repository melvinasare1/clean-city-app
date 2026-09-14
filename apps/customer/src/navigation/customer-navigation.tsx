
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { CustomerHomeScreen } from '../screens/customer/customer-home-screen/customer-home-screen';
import { BookPickupScreen } from '../screens/customer/book-pickup-screen';
import { MyBookingsScreen } from '../screens/customer/my-bookings/my-bookings-screen';
import { BookingListScreen } from '../screens/customer/booking-list-screen';
import { BookingDetailScreen } from '../screens/customer/booking-detail/booking-detail-screen';
import { CompleteProfileScreen } from '../screens/customer/complete-profile/complete-profile-screen';
import { SetPickupLocationScreen } from '../screens/customer/set-pickup-location-screen';
import { CreateBookingScreen } from '../screens/customer/create-booking/create-booking-screen';
import { PaymentCallbackScreen } from '../screens/customer/payment/payment-callback-screen';
import { PrivacyPolicyScreen } from '../screens/privacy-policy/privacy-policy-screen';
import { TermsAndConditionsScreen } from '../screens/terms-and-conditions/terms-and-conditions-screen';
import { ReferralProgramScreen } from "@/screens/referral/referral-program-screen";
import { RecyclingGuidesScreen } from '../screens/customer/recycling-guides/recycling-guides-screen';
import { CustomerProfileScreen } from '../screens/customer/customer-profile-screen';
import { HelpScreen } from '../screens/customer/help-screen';
import { PricingPlansScreen } from '../screens/customer/pricing-plans-screen';
import { StoreScreen } from '../screens/customer/store-screen';
import { CartScreen } from '../screens/customer/cart-screen';
import { PaymentMethodsScreen } from '../screens/customer/payment-methods-screen';
import { COLORS } from '../lib/constants';

import {
    CustomerStackParamList,
    CustomerTabParamList,
} from './types';

const Stack = createNativeStackNavigator<CustomerStackParamList>();
const Tab = createBottomTabNavigator<CustomerTabParamList>();

const CustomerTabs = () => (
    <Tab.Navigator
        screenOptions={{
            tabBarActiveTintColor: COLORS.primary,
            tabBarInactiveTintColor: COLORS.textSecondary,
            tabBarStyle: {
                backgroundColor: COLORS.white,
                borderTopWidth: 1,
                borderTopColor: COLORS.background,
            },
            tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '600',
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
                tabBarIcon: ({ color, focused }) => (
                    <Ionicons
                        name={focused ? 'home' : 'home-outline'}
                        size={22}
                        color={color}
                    />
                ),
                headerShown: false,
            }}
        />
        <Tab.Screen
            name="MyBookings"
            component={MyBookingsScreen}
            options={{
                title: 'My Bookings',
                tabBarLabel: 'Bookings',
                tabBarIcon: ({ color, focused }) => (
                    <Ionicons
                        name={focused ? 'calendar' : 'calendar-outline'}
                        size={22}
                        color={color}
                    />
                ),
                headerShown: false,
            }}
        />
        <Tab.Screen
            name="CustomerProfile"
            component={CustomerProfileScreen}
            options={{
                title: 'Profile',
                tabBarLabel: 'Profile',
                tabBarIcon: ({ color, focused }) => (
                    <Ionicons
                        name={focused ? 'person' : 'person-outline'}
                        size={22}
                        color={color}
                    />
                ),
                headerShown: false,
            }}
        />
        <Tab.Screen
            name="CustomerHelp"
            component={HelpScreen}
            options={{
                title: 'Help',
                tabBarLabel: 'Help',
                tabBarIcon: ({ color, focused }) => (
                    <Ionicons
                        name={focused ? 'help-circle' : 'help-circle-outline'}
                        size={22}
                        color={color}
                    />
                ),
                headerShown: false,
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
                headerBackTitleVisible: false,
            }}
        >
            <Stack.Screen
                name="CustomerTabs"
                component={CustomerTabs}
                options={{ headerShown: false, title: '' }}
            />
            <Stack.Screen
                name="NewBooking"
                component={BookPickupScreen}
                options={{ headerShown: false, title: 'Book a Pickup' }}
            />
            <Stack.Screen
                name="CreateBooking"
                component={CreateBookingScreen}
                options={{ headerShown: false, title: 'Schedule Pickup' }}
            />
            <Stack.Screen
                name="BookingDetail"
                component={BookingDetailScreen}
                options={{ headerShown: false, title: 'Booking Details' }}
            />
            <Stack.Screen
                name="BookingsList"
                component={BookingListScreen}
                options={{ headerShown: false, title: 'Bookings' }}
            />
            <Stack.Screen
                name="CompleteProfile"
                component={CompleteProfileScreen}
                options={{ title: 'Complete Profile' }}
            />
            <Stack.Screen
                name="SetPickupLocation"
                component={SetPickupLocationScreen}
                options={{ headerShown: false, title: 'Set pickup' }}
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
                name="TermsAndConditions"
                component={TermsAndConditionsScreen}
                options={{ title: 'Terms & Conditions' }}
            />
            <Stack.Screen
              name="ReferralProgram"
              component={ReferralProgramScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="RecyclingGuides"
              component={RecyclingGuidesScreen}
              options={{ title: 'Recycling Guides' }}
            />
            <Stack.Screen
              name="PricingPlans"
              component={PricingPlansScreen}
              options={{ title: 'Pricing & Plans' }}
            />
            <Stack.Screen
              name="Store"
              component={StoreScreen}
              options={{ headerShown: false, title: 'Store' }}
            />
            <Stack.Screen
              name="Cart"
              component={CartScreen}
              options={{ headerShown: false, title: 'Cart' }}
            />
            <Stack.Screen
              name="PaymentMethods"
              component={PaymentMethodsScreen}
              options={{ title: 'Payment Methods' }}
            />
        </Stack.Navigator>
    );
};
