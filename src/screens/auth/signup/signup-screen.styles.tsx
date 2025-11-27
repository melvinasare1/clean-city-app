import { COLORS, VARS } from "@/lib/constants";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.white,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: VARS.medium,
    },
    header: {
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: VARS.large,
    },
    headerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: VARS.large,
    },
    title: {
        fontSize: VARS.large,
        fontWeight: 'bold',
        color: COLORS.primary,
        textAlign: 'center',
        marginBottom: VARS.xxsmall,
    },
    subtitle: {
        fontSize: VARS.small,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: VARS.large,
    },
    form: {
        flex: 1,
        justifyContent: 'center',
    },
    input: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.xxsmall,
        padding: VARS.small,
        fontSize: VARS.small,
        marginBottom: VARS.small,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    button: {
        backgroundColor: COLORS.primary,
        borderRadius: VARS.xxsmall,
        padding: VARS.small,
        alignItems: 'center',
        marginTop: VARS.xxsmall,
    },
    backToLogin: {
        backgroundColor: COLORS.white,
        color: 'grey',
        textAlign: 'center'
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: VARS.small,
        fontWeight: '600',
    },
    actionLink: {
        backgroundColor: 'black',
        marginTop: 'auto',
    },
    linkText: {
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginTop: VARS.medium,
        fontSize: VARS.xsmall + 2,
    },
    linkTextBold: {
        color: COLORS.primary,
        fontWeight: '600',
    },
});

