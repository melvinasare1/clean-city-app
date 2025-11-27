import { VARS, COLORS } from '@/lib/constants';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    base: {
        paddingVertical: VARS.small,
        paddingHorizontal: VARS.medium,
        borderRadius: VARS.xxsmall,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: VARS.xlarge,
    },
    primary: {
        backgroundColor: COLORS.primary,
    },
    secondary: {
        backgroundColor: COLORS.white,
        borderWidth: VARS.xxsmall / 4,
        borderColor: COLORS.primary,
    },
    text: {
        backgroundColor: 'transparent',
    },
    disabled: {
        opacity: 0.6,
    },
    baseText: {
        fontSize: VARS.small,
        fontWeight: '600',
    },
    primaryText: {
        color: COLORS.white,
    },
    secondaryText: {
        color: COLORS.primary,
    },
    textText: {
        color: COLORS.primary,
    },
});
