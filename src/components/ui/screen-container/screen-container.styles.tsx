import { COLORS } from '@/lib/constants';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    keyboardAvoid: {
        flex: 1,
    },
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        flexGrow: 1,
    },
});

