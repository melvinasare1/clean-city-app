import React from 'react';
import { NativeModules } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CustomerStackParamList } from '@/navigation/types';
import { SetPickupLocationFallbackScreen } from './set-pickup-location-fallback';

type Props = NativeStackScreenProps<CustomerStackParamList, 'SetPickupLocation'>;

export function SetPickupLocationScreen(props: Props) {
  if (NativeModules.RNMBXModule == null) {
    return <SetPickupLocationFallbackScreen {...props} />;
  }

  const { SetPickupLocationMapScreen } =
    require('./set-pickup-location-map') as typeof import('./set-pickup-location-map');
  return <SetPickupLocationMapScreen {...props} />;
}
