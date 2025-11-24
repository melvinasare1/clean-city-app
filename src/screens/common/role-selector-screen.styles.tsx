import { COLORS, VARS } from "@/lib/constants";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
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
        textAlign: 'center',
        marginBottom: VARS.xsmall,
    },
    subtitle: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: VARS.xlarge,
        paddingHorizontal: VARS.small,
    },
    roleButton: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.small,
        padding: VARS.medium,
        marginBottom: VARS.small,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: COLORS.primary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: VARS.xxsmall / 2 },
        shadowOpacity: 0.1,
        shadowRadius: VARS.xxsmall,
        elevation: 5,
    },
    roleButtonDriver: {
        borderColor: COLORS.accent,
    },
    roleEmoji: {
        fontSize: VARS.xlarge,
        marginBottom: VARS.xsmall,
    },
    roleTitle: {
        fontSize: VARS.small + 4,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: VARS.xxsmall,
    },
    roleDescription: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
});
