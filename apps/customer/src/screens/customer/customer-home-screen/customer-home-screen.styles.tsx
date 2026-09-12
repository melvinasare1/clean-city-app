import { COLORS, VARS } from '@/lib/constants';
import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        backgroundColor: COLORS.primary,
        paddingTop: VARS.xxlarge + 4,
        paddingBottom: VARS.large,
        width: '100%',
    },
    headerInner: {
        width: '100%',
        paddingHorizontal: VARS.medium,
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: VARS.medium,
    },
    content: {
        padding: VARS.small,
        width: '100%',
    },
    profileBanner: {
        backgroundColor: '#E8F5E9',
        borderRadius: VARS.medium,
        padding: VARS.medium,
        marginBottom: VARS.small,
        borderWidth: 1,
        borderColor: '#C8E6C9',
    },
    profileBannerRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: VARS.small,
        marginBottom: VARS.small,
    },
    profileBannerTextCol: {
        flex: 1,
        minWidth: 0,
    },
    profileBannerIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileBannerTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 2,
    },
    profileBannerSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        lineHeight: 18,
        flexShrink: 1,
    },
    profileProgressRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    profileProgressLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.success,
    },
    profileProgressBarBg: {
        height: 4,
        borderRadius: 2,
        backgroundColor: '#C8E6C9',
        overflow: 'hidden',
    },
    profileProgressBarFill: {
        height: '100%',
        backgroundColor: COLORS.primary,
        borderRadius: 2,
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
    actionButtonMuted: {
        opacity: 0.85,
    },
    actionButtonText: {
        color: COLORS.white,
        fontSize: VARS.small,
        fontWeight: '600',
    },
    actionButtonHint: {
        color: COLORS.white,
        fontSize: 11,
        opacity: 0.9,
        marginTop: 4,
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
