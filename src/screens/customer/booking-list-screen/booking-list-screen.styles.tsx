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
        borderRadius: VARS.xsmall,
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
        marginBottom: VARS.xxsmall,
    },
    cardDate: {
        fontSize: VARS.small,
        fontWeight: '600',
        color: COLORS.text,
    },
    statusBadge: {
        paddingHorizontal: VARS.xsmall,
        paddingVertical: VARS.xxsmall / 2,
        borderRadius: VARS.xsmall,
    },
    statusText: {
        color: COLORS.white,
        fontSize: VARS.xsmall,
        fontWeight: '600',
    },
    cardPrice: {
        fontSize: VARS.small + 2,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: VARS.xxsmall / 2,
    },
    cardNote: {
        fontSize: VARS.xsmall,
        color: COLORS.textSecondary,
        fontStyle: 'italic',
    },
    placeholderCard: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.xsmall,
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
