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
        alignItems: 'center',
        paddingHorizontal: VARS.medium,
    },
    title: {
        fontSize: VARS.large,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: VARS.small,
    },
    subtitle: {
        fontSize: VARS.medium,
        color: COLORS.textSecondary,
        marginBottom: VARS.small,
    },
    description: {
        fontSize: VARS.small,
        color: COLORS.textSecondary,
        textAlign: 'center',
        marginBottom: VARS.large,
    },
    button: {
        backgroundColor: COLORS.primary,
        borderRadius: VARS.xxsmall,
        padding: VARS.small,
        paddingHorizontal: VARS.large,
    },
    buttonText: {
        color: COLORS.white,
        fontSize: VARS.small,
        fontWeight: '600',
    },
});

