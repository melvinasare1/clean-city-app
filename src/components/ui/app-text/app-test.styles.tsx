import { COLORS, VARS } from '@/lib/constants';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    base: {
        fontSize: 16,
        color: COLORS.text,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    caption: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
});

