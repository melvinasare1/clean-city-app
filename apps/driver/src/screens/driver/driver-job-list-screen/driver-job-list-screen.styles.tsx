import { COLORS, VARS } from "@/lib/constants";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    content: {
        padding: VARS.small,
    },
    title: {
        fontSize: VARS.medium,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: VARS.small,
    },
    card: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.small,
        padding: VARS.small,
        marginBottom: VARS.xsmall,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: VARS.xxsmall / 4 },
        shadowOpacity: 0.1,
        shadowRadius: VARS.xxsmall / 2,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: VARS.xsmall,
    },
    cardAddress: {
        fontSize: VARS.small,
        fontWeight: '600',
        color: COLORS.text,
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: VARS.xsmall,
        paddingVertical: VARS.xxsmall / 2,
        borderRadius: VARS.xsmall,
    },
    statusText: {
        color: COLORS.white,
        fontSize: VARS.xxsmall + 2,
        fontWeight: '600',
    },
    cardDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: VARS.xxsmall,
    },
    cardTime: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.textSecondary,
    },
    cardEarnings: {
        fontSize: VARS.small,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    cardNote: {
        fontSize: VARS.xsmall,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
    },
    placeholderCard: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.small,
        padding: VARS.medium,
        marginTop: VARS.small,
        alignItems: 'center',
    },
    placeholderText: {
        color: COLORS.textSecondary,
        fontSize: VARS.xsmall + 2,
        textAlign: 'center',
    },
});
