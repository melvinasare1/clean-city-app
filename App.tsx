/**
 * App.tsx - Main Application Entry Point
 * 
 * This is the root component that:
 * - Wraps the app in NavigationContainer
 * - Provides the RootNavigator which handles all routing logic
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/root-navigation';

export default function App() {
    return (
        <NavigationContainer>
            <StatusBar style="auto" />
            <RootNavigator />
        </NavigationContainer>
    );
}

