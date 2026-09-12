import { COLORS, VARS } from '@/lib/constants';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    input: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.xxsmall,
        padding: VARS.small,
        fontSize: VARS.small,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        color: COLORS.text,
    },
});

