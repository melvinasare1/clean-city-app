import { COLORS, VARS } from '@/lib/constants';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    base: {
        fontSize: VARS.small,
        color: COLORS.text,
    },
    title: {
        fontSize: VARS.medium + 8,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: VARS.small - 2,
        color: COLORS.textSecondary,
    },
    caption: {
        fontSize: VARS.xsmall,
        color: COLORS.textSecondary,
    },
});

