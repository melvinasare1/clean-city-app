import { COLORS, VARS } from "@/lib/constants";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.primary,
        padding: VARS.medium,
        paddingTop: VARS.xxlarge + 4,
        paddingBottom: VARS.large,
    },
    title: {
        fontSize: VARS.medium + 4,
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
    card: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.xsmall,
        padding: VARS.small + 4,
        marginBottom: VARS.small,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: VARS.xxsmall / 4 },
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
        borderRadius: VARS.xsmall - 4,
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
    placeholderText: {
        color: COLORS.textSecondary,
        fontSize: VARS.xsmall + 2,
        fontStyle: 'italic',
    },
    testStyle: {
        flex: 1,
        justifyContent: 'flex-end'
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
    recyclingGuideCard: {
        backgroundColor: COLORS.white,
        borderRadius: VARS.xsmall,
        padding: VARS.small + 4,
        marginTop: VARS.small,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: VARS.xxsmall / 4 },
        shadowOpacity: 0.1,
        shadowRadius: VARS.xxsmall / 2,
        elevation: 3,
    },
    recyclingGuideContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    recyclingGuideTextContainer: {
        flex: 1,
        marginRight: VARS.xsmall,
    },
    recyclingGuideTitle: {
        fontSize: VARS.small + 2,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: VARS.xxsmall / 2,
    },
    recyclingGuideSubtitle: {
        fontSize: VARS.xsmall + 2,
        color: COLORS.textSecondary,
        lineHeight: VARS.small + 2,
    },
});
