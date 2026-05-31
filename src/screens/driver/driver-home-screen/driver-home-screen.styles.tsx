import { COLORS, VARS } from "../../../lib/constants";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.primary,
        padding: VARS.medium,
        paddingTop: 60,
        paddingBottom: VARS.large,
    },
    title: {
        fontSize: VARS.medium + 2,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: VARS.xxsmall / 2,
    },
    subtitle: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.white,
        opacity: 0.8,
    },
    content: {
        padding: VARS.small,
    },
    statsRow: {
        flexDirection: 'row',
        marginBottom: VARS.small,
        gap: VARS.xsmall,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.white,
        borderRadius: VARS.xsmall,
        padding: VARS.small + 4,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: VARS.xxsmall / 2,
        elevation: 3,
    },
    statValue: {
        fontSize: VARS.large,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: VARS.xxsmall / 2,
    },
    statLabel: {
        fontSize: VARS.xsmall,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.xsmall,
        padding: 20,
        marginBottom: VARS.small,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: VARS.xxsmall / 2,
        elevation: 3,
    },
    cardTitle: {
        fontSize: VARS.small + 2,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: VARS.small,
    },
    actionButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 8,
        padding: VARS.small,
        marginBottom: VARS.xsmall,
        alignItems: 'center',
    },
    actionButtonText: {
        color: COLORS.white,
        fontSize: VARS.small,
        fontWeight: '600',
    },
    actionButtonSecondary: {
        backgroundColor: COLORS.white,
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    actionButtonTextSecondary: {
        color: COLORS.primary,
        fontSize: VARS.small,
        fontWeight: '600',
    },
    actionButtonDisabled: {
        opacity: 0.55,
    },
    placeholderText: {
        color: COLORS.textSecondary,
        fontSize: VARS.xsmall + 2,
        fontStyle: 'italic',
    },
    logoutButton: {
        marginTop: VARS.small,
        padding: VARS.small,
        alignItems: 'center',
    },
    logoutButtonText: {
        color: COLORS.error,
        fontSize: VARS.small,
        fontWeight: '600',
    },
});

