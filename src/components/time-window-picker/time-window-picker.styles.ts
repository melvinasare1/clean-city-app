import { StyleSheet } from 'react-native';
import { COLORS, VARS } from '@/lib/constants';

const GREEN_LIGHT = '#E8F5E9';
const GREEN_BORDER = '#A5D6A7';

export const styles = StyleSheet.create({
  list: {
    marginTop: VARS.xsmall,
    gap: VARS.small,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VARS.medium,
    paddingHorizontal: VARS.medium,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E8E8E8',
    backgroundColor: COLORS.white,
    gap: VARS.small,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: GREEN_LIGHT,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {},
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  titleSelected: {
    color: COLORS.primary,
  },
  timeRange: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '400',
  },
  timeRangeSelected: {
    color: GREEN_BORDER,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#BDBDBD',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
  },
  radioOuterSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
  },
});
