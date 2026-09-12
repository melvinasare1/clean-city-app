// Design tokens extracted from the approved driver-home mockup.
// See docs/DRIVER_HOME_DESIGN_SPEC.md for the full rationale.

export const colors = {
  brandGreen: '#1C5A3B',
  brandGreenSoft: '#DFF3E6',
  brandGreenDot: '#2ECC71',

  inkCharcoal: '#333B46',
  inkPrimary: '#1A1A1A',
  inkSecondary: '#6B7280',

  signalRed: '#E14B3D',

  mapBg: '#E8E8E8',
  mapPark: '#C9E4C0',
  mapWater: '#AFD4EA',
  mapRoad: '#FFFFFF',

  locationDot: '#2F6FED',
  locationHalo: 'rgba(47,111,237,0.18)',

  surfaceWhite: '#FFFFFF',
  surfaceMutedIcon: '#ECECEC',

  shadow: 'rgba(0,0,0,0.15)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
};

export const radius = {
  sheet: 24,
  pill: 999,
  card: 16,
};

export const typography = {
  headline: { fontSize: 18, fontWeight: '700' as const, color: colors.inkPrimary },
  body: { fontSize: 14, fontWeight: '500' as const, color: colors.inkSecondary },
  earningsValue: { fontSize: 20, fontWeight: '800' as const, color: colors.inkPrimary },
  earningsLabel: { fontSize: 12, fontWeight: '600' as const, color: colors.inkSecondary },
  statusTitle: { fontSize: 15, fontWeight: '700' as const, color: colors.inkPrimary },
  statusSubtext: { fontSize: 13, fontWeight: '500' as const, color: colors.inkSecondary },
  button: { fontSize: 16, fontWeight: '700' as const },
};

export const sizes = {
  floatingButton: 48,
  topBarButton: 44,
};
