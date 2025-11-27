import { StyleSheet } from "react-native";
import { COLORS, VARS } from "@/lib/constants";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: VARS.small,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: VARS.small,
    },
    title: {
        fontSize: VARS.medium,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    statusBadge: {
        backgroundColor: '#2196F3',
        paddingHorizontal: VARS.xsmall,
        paddingVertical: VARS.xxsmall - 2,
        borderRadius: VARS.xsmall,
    },
    statusText: {
        color: COLORS.white,
        fontSize: VARS.xsmall,
        fontWeight: '600',
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.xsmall,
        padding: VARS.small + 4,
        marginBottom: VARS.small,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: VARS.xxsmall / 2,
        elevation: 3,
    },
    sectionTitle: {
        fontSize: VARS.small,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: VARS.xsmall,
    },
    address: {
        fontSize: VARS.small,
        color: COLORS.text,
        marginBottom: VARS.xxsmall,
    },
    timeWindow: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.textSecondary,
    },
    infoText: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.text,
        marginBottom: VARS.xxsmall / 2,
    },
    binItem: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.text,
        marginBottom: VARS.xxsmall / 2,
    },
    earnings: {
        fontSize: VARS.large,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    notes: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.text,
        fontStyle: 'italic',
    },
    actionButton: {
        backgroundColor: COLORS.primary,
        borderRadius: VARS.xxsmall,
        padding: VARS.small,
        alignItems: 'center',
        marginBottom: VARS.xsmall,
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
        borderRadius: VARS.xxsmall,
        padding: VARS.small,
        alignItems: 'center',
        marginBottom: VARS.xsmall,
    },
    actionButtonTextSecondary: {
        color: COLORS.primary,
        fontSize: VARS.small,
        fontWeight: '600',
    },
    placeholderText: {
        color: COLORS.textSecondary,
        fontSize: VARS.xsmall,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: VARS.xxsmall,
        marginBottom: VARS.medium,
    },
});

