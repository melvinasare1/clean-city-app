import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AdminPushScreen } from '../screens/admin/admin-push-screen';
import { COLORS } from '../lib/constants';
import { AdminStackParamList } from './types';

const Stack = createNativeStackNavigator<AdminStackParamList>();

export const AdminNavigator: React.FC = () => {
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
        name="AdminPush"
        component={AdminPushScreen}
        options={{ title: 'Send Push Notification' }}
      />
    </Stack.Navigator>
  );
};

