import React from 'react';
import { UIManager } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CustomerStackParamList } from '@/navigation/types';
import { SetPickupLocationFallbackScreen } from './set-pickup-location-fallback';

type Props = NativeStackScreenProps<CustomerStackParamList, 'SetPickupLocation'>;

export function SetPickupLocationScreen(props: Props) {
  // react-native-maps registers its native view as "AIRMap" — this is null
  // when the running binary predates the map module being linked, same
  // guard the old Mapbox check served (an OTA JS update can outrun a native
  // rebuild, so this can't be a build-time check).
  if (UIManager.getViewManagerConfig('AIRMap') == null) {
    return <SetPickupLocationFallbackScreen {...props} />;
  }

  const { SetPickupLocationMapScreen } =
    require('./set-pickup-location-map') as typeof import('./set-pickup-location-map');
  return <SetPickupLocationMapScreen {...props} />;
}
