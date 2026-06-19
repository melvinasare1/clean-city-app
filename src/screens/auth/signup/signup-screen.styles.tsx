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
    responsiveOuter: {
        flex: 1,
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
    roleLabel: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.textSecondary,
        marginBottom: VARS.xxsmall,
    },
    roleRow: {
        flexDirection: 'row',
        gap: VARS.small,
        marginBottom: VARS.small,
    },
    roleOption: {
        flex: 1,
        paddingVertical: VARS.small,
        paddingHorizontal: VARS.xsmall,
        borderRadius: VARS.xxsmall,
        borderWidth: 2,
        borderColor: '#E0E0E0',
        alignItems: 'center',
    },
    roleOptionSelected: {
        borderColor: COLORS.primary,
        backgroundColor: `${COLORS.primary}10`,
    },
    roleOptionText: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.textSecondary,
    },
    roleOptionTextSelected: {
        color: COLORS.primary,
        fontWeight: '600',
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
    dividerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: VARS.small,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E0E0E0',
    },
    dividerText: {
        marginHorizontal: VARS.xxsmall,
        color: COLORS.textSecondary,
        fontSize: VARS.xsmall,
    },
    socialButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: VARS.xxsmall,
        padding: VARS.small,
        marginBottom: VARS.xxsmall,
        backgroundColor: COLORS.white,
    },
    socialButtonText: {
        fontSize: VARS.small,
        color: COLORS.text,
        fontWeight: '500',
        marginLeft: VARS.xxsmall,
    },
    appleButton: {
        backgroundColor: '#000',
        borderColor: '#000',
    },
    appleButtonText: {
        color: COLORS.white,
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

