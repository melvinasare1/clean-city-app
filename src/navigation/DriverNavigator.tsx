/**
 * Driver Navigator
 * 
 * Stack navigator for driver-facing screens
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DriverHomeScreen } from '../screens/driver/driver-home-screen/driver-home-screen';
import { DriverJobListScreen } from '../screens/driver/driver-job-list-screen/driver-job-list-screen';
import { DriverJobDetailScreen } from '../screens/driver/driver-job-details-screen/driver-job-details-screen';
import { COLORS } from '../lib/constants';

export type DriverStackParamList = {
    DriverHome: undefined;
    DriverJobList: undefined;
    DriverJobDetail: { jobId: string };
};

const Stack = createNativeStackNavigator<DriverStackParamList>();

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
            }}
        >
            <Stack.Screen
                name="DriverHome"
                component={DriverHomeScreen}
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
        </Stack.Navigator>
    );
};

