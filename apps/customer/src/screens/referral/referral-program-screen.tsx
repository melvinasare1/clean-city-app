import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Linking,
    Pressable,
    ScrollView,
    Share,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';

import { AppText, AppTextInput } from '@/components';
import { COLORS } from '@/lib/constants';
import { styles } from './referral-program-screen.styles';
import { useAuth } from '@/hooks/useAuth';
import { useReferralWindow } from '@/hooks/useReferralWindow';
import { trackEvent, trackScreenOnFocus } from '@/services/analytics';
import { applyReferralCode, getReferralStats } from '@/services/referral-api';
import {
    listenToProfile,
    listenToReferralsAsReferrer,
    type ProfileReferralData,
    type ReferralDoc,
} from '@/services/referralService';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CustomerStackParamList } from '@/navigation/types';
import {
    buildReferralShareMessage,
    buildWhatsAppShareUrl,
    getReferralErrorMessage,
    getReferralStatsDisplay,
    isReferralCodeFormatValid,
    normalizeReferralCodeInput,
    sanitizeReferralCodeInput,
    REFERRAL_CODE_MAX_LENGTH,
} from '@/lib/referral-utils';
import type { ReferralApplyErrorCode } from '@/types/referral';
import type { ReferralStatsResponse } from '@/types/referral';

type Props = NativeStackScreenProps<CustomerStackParamList, 'ReferralProgram'>;

const HOW_IT_WORKS_STEPS = [
    'Share your code with friends in Accra',
    'They get 10% off their first pickup',
    'You earn 1 free pickup for every 3 friends who book',
];

export const ReferralProgramScreen: React.FC<Props> = ({ navigation }) => {
    const { user, refreshUserProfile } = useAuth();

    trackScreenOnFocus('referral_program', { has_user: !!user });

    const [profile, setProfile] = useState<ProfileReferralData | null>(null);
    const [referrals, setReferrals] = useState<ReferralDoc[]>([]);
    const [stats, setStats] = useState<ReferralStatsResponse | null>(null);
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingReferrals, setLoadingReferrals] = useState(true);
    const [loadingStats, setLoadingStats] = useState(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [enterCodeInput, setEnterCodeInput] = useState('');
    const [enterCodeError, setEnterCodeError] = useState<string | null>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [codeAppliedSuccess, setCodeAppliedSuccess] = useState(false);
    const [copied, setCopied] = useState(false);

    const referralWindowUser = useMemo(
        () => ({
            signupAt: user?.signupAt ?? profile?.signupAt,
            firstBookingAt: user?.firstBookingAt ?? profile?.firstBookingAt,
            referralCodeApplied:
                user?.referralCodeApplied ?? profile?.referralCodeApplied ?? false,
        }),
        [user, profile]
    );

    const { referralWindowOpen, timeRemainingLabel } =
        useReferralWindow(referralWindowUser);

    const referralCode = useMemo(() => {
        if (!user) return 'CC-XXXXXX';
        if (profile?.referralCode) return profile.referralCode;
        if (user.referralCode) return user.referralCode;
        return `CC-${user.id.slice(0, 6).toUpperCase()}`;
    }, [user, profile?.referralCode]);

    const successfulReferrals = useMemo(
        () => referrals.filter((r) => r.status === 'completed').length,
        [referrals]
    );

    const displayStats = useMemo(() => {
        if (stats) {
            const more = getReferralStatsDisplay(
                stats.friendsReferred,
                stats.freePickupThreshold
            );
            return {
                friendsReferred: stats.friendsReferred,
                freePickupsEarned: stats.freePickupsEarned,
                moreForFreePickup: more.moreForFreePickup,
            };
        }
        const fallback = getReferralStatsDisplay(successfulReferrals);
        return {
            friendsReferred: fallback.friendsReferred,
            freePickupsEarned: fallback.freePickupsEarned,
            moreForFreePickup: fallback.moreForFreePickup,
        };
    }, [stats, successfulReferrals]);

    const enterCodeValid = useMemo(
        () => isReferralCodeFormatValid(enterCodeInput),
        [enterCodeInput]
    );

    useEffect(() => {
        if (user?.referralCodeApplied) {
            setCodeAppliedSuccess(true);
        }
    }, [user?.referralCodeApplied]);

    useEffect(() => {
        if (!user?.id) {
            setProfile(null);
            setReferrals([]);
            setLoadingProfile(false);
            setLoadingReferrals(false);
            setLoadingStats(false);
            return;
        }

        setErrorMessage(null);
        setLoadingProfile(true);
        setLoadingReferrals(true);
        setLoadingStats(true);

        const unsubscribeProfile = listenToProfile(
            user.id,
            (data) => {
                setProfile(data);
                setLoadingProfile(false);
                if (data.referralCodeApplied) {
                    setCodeAppliedSuccess(true);
                }
            },
            () => {
                setErrorMessage(
                    "We couldn't load your referral profile. Please try again later."
                );
                setLoadingProfile(false);
            }
        );

        const unsubscribeReferrals = listenToReferralsAsReferrer(
            user.id,
            (docs) => {
                setReferrals(docs);
                setLoadingReferrals(false);
            },
            () => {
                setErrorMessage(
                    "We couldn't load your referrals list. Please try again later."
                );
                setLoadingReferrals(false);
            }
        );

        getReferralStats()
            .then(setStats)
            .catch(() => {
                // Fall back to Firestore listener counts
            })
            .finally(() => setLoadingStats(false));

        return () => {
            unsubscribeProfile();
            unsubscribeReferrals();
        };
    }, [user?.id]);

    const handleCopyCode = useCallback(async () => {
        await Clipboard.setStringAsync(referralCode);
        setCopied(true);
        trackEvent('referral_code_copied', {
            screen: 'referral_program',
            code_length: referralCode.length,
        }).catch(() => {});
        setTimeout(() => setCopied(false), 2000);
    }, [referralCode]);

    const handleWhatsAppShare = useCallback(async () => {
        const message = buildReferralShareMessage(referralCode);
        const url = buildWhatsAppShareUrl(message);
        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                await Share.share({ message });
            }
            trackEvent('referral_share_started', {
                screen: 'referral_program',
                channel: 'whatsapp',
            }).catch(() => {});
        } catch (error) {
            console.error('WhatsApp share error:', error);
        }
    }, [referralCode]);

    const handleShareLink = useCallback(async () => {
        const message = buildReferralShareMessage(referralCode);
        try {
            await Share.share({ message });
            trackEvent('referral_share_started', {
                screen: 'referral_program',
                channel: 'native',
            }).catch(() => {});
        } catch (error) {
            console.error('Share error:', error);
        }
    }, [referralCode]);

    const handleApplyCode = useCallback(async () => {
        if (!enterCodeValid) return;

        setIsApplying(true);
        setEnterCodeError(null);

        try {
            const result = await applyReferralCode(
                normalizeReferralCodeInput(enterCodeInput)
            );

            if (result.success) {
                setCodeAppliedSuccess(true);
                setEnterCodeInput('');
                await refreshUserProfile();
                return;
            }

            const code = result.error as ReferralApplyErrorCode | undefined;
            setEnterCodeError(
                code ? getReferralErrorMessage(code) : 'Something went wrong. Please try again.'
            );
        } catch {
            setEnterCodeError('Something went wrong. Please try again.');
        } finally {
            setIsApplying(false);
        }
    }, [enterCodeInput, enterCodeValid, refreshUserProfile]);

    const loading = loadingProfile || loadingReferrals || loadingStats;

    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <AppText style={styles.headerTitle}>Referrals</AppText>
                <View style={styles.centerContent}>
                    <AppText>Please log in to view referrals.</AppText>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.headerRow}>
                    <Pressable
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                        hitSlop={8}
                    >
                        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                    </Pressable>
                    <AppText style={styles.headerTitle}>Referrals</AppText>
                    <View style={styles.backButtonSpacer} />
                </View>

                {loading ? (
                    <ActivityIndicator
                        size="large"
                        color={COLORS.primary}
                        style={{ marginVertical: 24 }}
                    />
                ) : null}

                {errorMessage ? (
                    <AppText style={styles.errorText}>{errorMessage}</AppText>
                ) : null}

                {!loading && referralWindowOpen && !codeAppliedSuccess ? (
                    <View style={styles.enterCodeCard}>
                        <AppText style={styles.enterCodeTitle}>
                            Still time to enter a code
                        </AppText>
                        <AppText style={styles.enterCodeCountdown}>
                            {timeRemainingLabel}
                        </AppText>
                        <View style={styles.enterCodeRow}>
                            <AppTextInput
                                value={enterCodeInput}
                                onChangeText={(v) => {
                                    setEnterCodeInput(sanitizeReferralCodeInput(v));
                                    setEnterCodeError(null);
                                }}
                                placeholder="e.g. CC-ABC123"
                                autoCapitalize="characters"
                                autoCorrect={false}
                                maxLength={REFERRAL_CODE_MAX_LENGTH}
                                style={styles.enterCodeInput}
                            />
                            <Pressable
                                style={[
                                    styles.applyButton,
                                    (!enterCodeValid || isApplying) &&
                                        styles.applyButtonDisabled,
                                ]}
                                onPress={handleApplyCode}
                                disabled={!enterCodeValid || isApplying}
                            >
                                {isApplying ? (
                                    <ActivityIndicator color={COLORS.white} size="small" />
                                ) : (
                                    <AppText style={styles.applyButtonText}>Apply code</AppText>
                                )}
                            </Pressable>
                        </View>
                        {enterCodeError ? (
                            <AppText style={styles.inlineError}>{enterCodeError}</AppText>
                        ) : null}
                    </View>
                ) : null}

                {!loading && codeAppliedSuccess ? (
                    <View style={styles.successCard}>
                        <Ionicons
                            name="checkmark-circle"
                            size={28}
                            color={COLORS.success}
                        />
                        <AppText style={styles.successText}>
                            Code applied! 10% off your first pickup
                        </AppText>
                    </View>
                ) : null}

                {!loading ? (
                    <>
                        <View style={styles.yourCodeCard}>
                            <AppText style={styles.yourCodeTitle}>
                                Your referral code
                            </AppText>
                            <AppText style={styles.yourCodeSubtext}>
                                Share this with friends — they get 10% off, you get a free
                                pickup after 3
                            </AppText>

                            <View style={styles.codeRow}>
                                <View style={styles.codeBox}>
                                    <AppText style={styles.codeText} numberOfLines={1}>
                                        {referralCode}
                                    </AppText>
                                </View>
                                <View>
                                    <Pressable
                                        style={styles.copyIconButton}
                                        onPress={handleCopyCode}
                                    >
                                        <Ionicons
                                            name={copied ? 'checkmark' : 'copy-outline'}
                                            size={22}
                                            color={COLORS.white}
                                        />
                                    </Pressable>
                                    {copied ? (
                                        <AppText style={styles.copiedLabel}>Copied!</AppText>
                                    ) : null}
                                </View>
                            </View>

                            <View style={styles.shareButtonsRow}>
                                <Pressable
                                    style={styles.whatsappButton}
                                    onPress={handleWhatsAppShare}
                                >
                                    <Ionicons
                                        name="logo-whatsapp"
                                        size={20}
                                        color={COLORS.white}
                                    />
                                    <AppText style={styles.whatsappButtonText}>
                                        WhatsApp
                                    </AppText>
                                </Pressable>
                                <Pressable
                                    style={styles.shareLinkButton}
                                    onPress={handleShareLink}
                                >
                                    <Ionicons
                                        name="share-outline"
                                        size={20}
                                        color={COLORS.primary}
                                    />
                                    <AppText style={styles.shareLinkButtonText}>
                                        Share link
                                    </AppText>
                                </Pressable>
                            </View>
                        </View>

                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <AppText style={styles.statValue}>
                                    {displayStats.friendsReferred}
                                </AppText>
                                <AppText style={styles.statLabel}>
                                    Friends referred
                                </AppText>
                            </View>
                            <View style={styles.statCard}>
                                <AppText style={styles.statValue}>
                                    {displayStats.moreForFreePickup} more
                                </AppText>
                                <AppText style={styles.statLabel}>
                                    For free pickup
                                </AppText>
                            </View>
                            <View style={styles.statCard}>
                                <AppText style={styles.statValue}>
                                    {displayStats.freePickupsEarned}
                                </AppText>
                                <AppText style={styles.statLabel}>
                                    Free pickups earned
                                </AppText>
                            </View>
                        </View>

                        <View style={styles.howItWorksCard}>
                            <AppText style={styles.howItWorksTitle}>How it works</AppText>
                            {HOW_IT_WORKS_STEPS.map((step, index) => (
                                <View key={step} style={styles.howItWorksStep}>
                                    <View style={styles.stepNumber}>
                                        <AppText style={styles.stepNumberText}>
                                            {index + 1}
                                        </AppText>
                                    </View>
                                    <AppText style={styles.stepText}>{step}</AppText>
                                </View>
                            ))}
                        </View>
                    </>
                ) : null}
            </ScrollView>
        </SafeAreaView>
    );
};
