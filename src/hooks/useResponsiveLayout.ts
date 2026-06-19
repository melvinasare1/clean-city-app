import { useMemo } from 'react';
import { useWindowDimensions, ViewStyle } from 'react-native';

/** iPad portrait and most tablet layouts */
export const TABLET_BREAKPOINT = 768;

/** Comfortable reading width on large screens (700–900px range) */
export const CONTENT_MAX_WIDTH = 900;

const HORIZONTAL_GUTTER = 32;

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const isWideScreen = width >= TABLET_BREAKPOINT;

  const contentMaxWidth = isWideScreen
    ? Math.min(CONTENT_MAX_WIDTH, width - HORIZONTAL_GUTTER)
    : width;

  const contentStyle = useMemo((): ViewStyle => {
    if (!isWideScreen) {
      return {
        width: '100%',
        alignSelf: 'stretch',
      };
    }

    return {
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
    };
  }, [contentMaxWidth, isWideScreen]);

  return {
    width,
    height,
    isWideScreen,
    contentMaxWidth,
    contentStyle,
  };
}
