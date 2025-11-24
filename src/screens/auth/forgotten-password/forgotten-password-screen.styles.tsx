import { StyleSheet } from 'react-native';
import { COLORS, VARS } from '../../../lib/constants';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: VARS.medium,
    },
    title: {
        fontSize: VARS.large,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: VARS.xsmall,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.textSecondary,
        marginBottom: VARS.xlarge,
        textAlign: 'center',
        lineHeight: VARS.small + 4,
    },
    form: {
        width: '100%',
    },
    inputWrapper: {
        marginBottom: VARS.small,
    },
    errorText: {
        color: COLORS.error,
        fontSize: VARS.xsmall,
        marginTop: VARS.xxsmall,
        marginLeft: VARS.xxsmall,
    },
    successText: {
        color: COLORS.success,
        fontSize: VARS.xsmall + 2,
        marginTop: VARS.small,
        textAlign: 'center',
        lineHeight: VARS.small + 4,
    },
    button: {
        marginTop: VARS.small,
    },
    backToLoginContainer: {
        marginTop: VARS.medium,
        alignItems: 'center',
    },
    backToLoginText: {
        color: COLORS.primary,
        fontSize: VARS.xsmall + 2,
        fontWeight: '600',
    },
});

