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
    sectionTitle: {
        fontSize: VARS.medium + 4,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: VARS.small,
        marginTop: VARS.xxsmall,
    },
    binCard: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.xsmall,
        padding: VARS.small,
        marginBottom: VARS.small,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    binInfo: {
        flex: 1,
    },
    binName: {
        fontSize: VARS.small,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: VARS.xxsmall / 2,
    },
    binPrice: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.textSecondary,
    },
    counter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    counterButton: {
        backgroundColor: COLORS.primary,
        width: VARS.medium + 4,
        height: VARS.medium + 4,
        borderRadius: VARS.small + 2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    counterButtonText: {
        color: COLORS.white,
        fontSize: VARS.small + 4,
        fontWeight: '600',
    },
    counterValue: {
        fontSize: VARS.small + 2,
        fontWeight: '600',
        color: COLORS.text,
        marginHorizontal: VARS.small,
        minWidth: VARS.medium + 4,
        textAlign: 'center',
    },
    totalCard: {
        backgroundColor: COLORS.primary,
        borderRadius: VARS.xsmall,
        padding: VARS.small + 4,
        marginVertical: VARS.small,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    totalLabel: {
        fontSize: VARS.small + 2,
        fontWeight: '600',
        color: COLORS.white,
    },
    totalValue: {
        fontSize: VARS.medium + 4,
        fontWeight: 'bold',
        color: COLORS.white,
    },
    placeholderText: {
        color: COLORS.textSecondary,
        fontSize: VARS.xsmall + 2,
        fontStyle: 'italic',
        marginBottom: VARS.small,
    },
    submitButton: {
        backgroundColor: COLORS.primary,
        borderRadius: VARS.xxsmall,
        padding: VARS.small,
        alignItems: 'center',
        marginTop: VARS.xxsmall,
        marginBottom: VARS.large,
    },
    submitButtonText: {
        color: COLORS.white,
        fontSize: VARS.small,
        fontWeight: '600',
    },
});
