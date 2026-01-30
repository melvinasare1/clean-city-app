import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ImageBackground,
    Pressable,
    ScrollView,
    Share,
    View,
    Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";

import { AppText } from "@/components";
import { COLORS } from "@/lib/constants";
import { styles } from "./referral-program-screen.styles";
import { useAuth } from "@/hooks/useAuth";
import { trackEvent, trackScreenOnFocus } from "@/services/analytics";
import {
    listenToProfile,
    listenToReferralsAsReferrer,
    type ProfileReferralData,
    type ReferralDoc,
} from "@/services/referralService";

// NOTE: When you add this screen to navigation, you can replace `any` with the exact route type.
type Props = {
    navigation: {
        goBack: () => void;
    };
};

const REWARD_TARGET_REFERRALS = 5;

export const ReferralProgramScreen: React.FC<Props> = ({ navigation }) => {
    const { user } = useAuth();

    // Track screen view
    trackScreenOnFocus("referral_program", {
        has_user: !!user,
    });

    const [profile, setProfile] = useState<ProfileReferralData | null>(null);
    const [referrals, setReferrals] = useState<ReferralDoc[]>([]);
    const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
    const [loadingReferrals, setLoadingReferrals] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Derived referral code with fallback if profile doc doesn't exist yet
    const referralCode = useMemo(() => {
        if (!user) return "CC-XXXXXX";
        if (profile?.referralCode) return profile.referralCode;
        const fallback = `CC-${user.id.slice(0, 6).toUpperCase()}`;
        return fallback;
    }, [user, profile?.referralCode]);

    const totalEarned = useMemo(() => {
        return referrals
            .filter((r) => r.status === "completed")
            .reduce((sum, r) => sum + (r.rewardAmount || 0), 0);
    }, [referrals]);

    const successfulReferrals = useMemo(
        () => referrals.filter((r) => r.status === "completed").length,
        [referrals]
    );

    const pendingReferrals = useMemo(
        () => referrals.filter((r) => r.status === "pending").length,
        [referrals]
    );

    const progress = useMemo(() => {
        if (REWARD_TARGET_REFERRALS <= 0) return 0;
        return Math.min(1, successfulReferrals / REWARD_TARGET_REFERRALS);
    }, [successfulReferrals]);

    useEffect(() => {
        if (!user?.id) {
            setProfile(null);
            setReferrals([]);
            setLoadingProfile(false);
            setLoadingReferrals(false);
            return;
        }

        setErrorMessage(null);
        setLoadingProfile(true);
        setLoadingReferrals(true);

        const unsubscribeProfile = listenToProfile(
            user.id,
            (data) => {
                setProfile(data);
                setLoadingProfile(false);
            },
            (error) => {
                setErrorMessage(
                    "We couldn't load your referral profile. Please try again later."
                );
                setLoadingProfile(false);
                trackEvent("referral_profile_error", {
                    screen: "referral_program",
                    user_id: user.id,
                }).catch(() => { });
            }
        );

        const unsubscribeReferrals = listenToReferralsAsReferrer(
            user.id,
            (docs) => {
                setReferrals(docs);
                setLoadingReferrals(false);
            },
            (error) => {
                setErrorMessage(
                    "We couldn't load your referrals list. Please try again later."
                );
                setLoadingReferrals(false);
                trackEvent("referral_list_error", {
                    screen: "referral_program",
                    user_id: user.id,
                }).catch(() => { });
            }
        );

        return () => {
            unsubscribeProfile();
            unsubscribeReferrals();
        };
    }, [user?.id]);

    const handleCopyCode = useCallback(async () => {
        await Clipboard.setStringAsync(referralCode);
        Alert.alert("Copied", "Referral code copied to clipboard.");
        trackEvent("referral_code_copied", {
            screen: "referral_program",
            code_length: referralCode.length,
        }).catch(() => { });
    }, [referralCode]);

    const handleShare = useCallback(
        async () => {
            const link = `https://cleancitygh.com?ref=${encodeURIComponent(
                referralCode
            )}`;
            const message = `Join Clean City and book your waste pickup. Use my code ${referralCode} or sign up with: ${link}`;

            try {
                await Share.share({ message });
                trackEvent("referral_share_started", {
                    screen: "referral_program",
                }).catch(() => { });
            } catch (error) {
                console.error("Error sharing referral link:", error);
                Alert.alert(
                    "Share failed",
                    "We couldn't open the share sheet. Please try again."
                );
                trackEvent("referral_share_error", {
                    screen: "referral_program",
                }).catch(() => { });
            }
        },
        [referralCode]
    );

    const loading = loadingProfile || loadingReferrals;

    // Render when user is not logged in
    if (!user) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.headerRow}>
                    <View style={styles.headerSide}>
                        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
                            <Ionicons
                                name="chevron-back"
                                size={24}
                                color={COLORS.text}
                            />
                        </Pressable>
                    </View>

                    <View style={styles.headerTitleWrapper}>
                        <AppText style={styles.headerTitle}>Referral Program</AppText>
                    </View>

                    <View style={styles.headerSideRight}>
                        <View style={styles.headerIconButton}>
                            <Ionicons
                                name="help-circle-outline"
                                size={18}
                                color={COLORS.white}
                            />
                        </View>
                    </View>
                </View>

                <View style={styles.centerContent}>
                    <AppText>Please log in to view referrals.</AppText>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.headerRow}>
                <View style={styles.headerSide}>
                    <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
                        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
                    </Pressable>
                </View>

                <View style={styles.headerTitleWrapper}>
                    <AppText style={styles.headerTitle}>Referral Program</AppText>
                </View>

                <View style={styles.headerSideRight}>
                    <Pressable
                        onPress={() =>
                            Alert.alert(
                                "Referral Help",
                                "Share your code or link with friends. You’ll earn credits after they complete their first paid pickup."
                            )
                        }
                        hitSlop={10}
                        style={styles.headerIconButton}
                    >
                        <Ionicons
                            name="help-circle-outline"
                            size={18}
                            color={COLORS.white}
                        />
                    </Pressable>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerContent}>
                    {errorMessage ? (
                        <AppText style={styles.errorText}>{errorMessage}</AppText>
                    ) : null}
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    {errorMessage ? (
                        <AppText style={styles.errorText}>{errorMessage}</AppText>
                    ) : null}

                    {/* Hero card */}
                    <View style={styles.heroCard}>
                        <ImageBackground
                            // Replace with a real asset if available
                            source={undefined as any}
                            style={styles.heroBackground}
                            imageStyle={{ resizeMode: "cover" }}
                        >
                            <View style={styles.heroInnerOverlay}>
                                <AppText style={styles.heroTitle}>
                                    Refer &amp; Earn Free{" "}
                                    {"\n"}
                                    Pickups
                                </AppText>
                            </View>
                        </ImageBackground>
                    </View>

                    {/* Description */}
                    <AppText style={styles.descriptionText}>
                        Help your friends go green. You'll get credit for every friend who
                        completes their first waste pickup.
                    </AppText>

                    {/* Referral code card */}
                    <View style={styles.referralCard}>
                        <AppText style={styles.referralCardLabel}>
                            YOUR UNIQUE REFERRAL CODE
                        </AppText>

                        <View style={styles.referralInner}>
                            <View style={styles.referralCodeWrapper}>
                                <AppText
                                    style={[styles.referralCodeText, styles.referralCodeLine]}
                                    numberOfLines={1}
                                >
                                    {referralCode}
                                </AppText>
                            </View>

                            <Pressable style={styles.copyButton} onPress={handleCopyCode}>
                                <Ionicons name="copy" size={18} color={COLORS.white} />
                                <AppText style={styles.copyButtonText}>Copy</AppText>
                            </Pressable>
                        </View>
                    </View>

                    {/* Share section */}
                    <View style={styles.shareSection}>
                        <AppText style={styles.shareTitle}>Share your link via</AppText>

                        <View style={styles.shareRow}>
                            <View style={styles.shareItem}>
                                <Pressable
                                    style={styles.shareItemCircle}
                                    onPress={handleShare}
                                >
                                    <Ionicons
                                        name="logo-whatsapp"
                                        size={24}
                                        color={COLORS.primary}
                                    />
                                </Pressable>
                                <AppText style={styles.shareItemLabel}>WhatsApp</AppText>
                            </View>

                            <View style={styles.shareItem}>
                                <Pressable
                                    style={styles.shareItemCircle}
                                    onPress={handleShare}
                                >
                                    <Ionicons
                                        name="chatbubble"
                                        size={22}
                                        color={COLORS.primary}
                                    />
                                </Pressable>
                                <AppText style={styles.shareItemLabel}>Messages</AppText>
                            </View>

                            <View style={styles.shareItem}>
                                <Pressable
                                    style={styles.shareItemCircle}
                                    onPress={handleShare}
                                >
                                    <Ionicons
                                        name="mail"
                                        size={22}
                                        color={COLORS.primary}
                                    />
                                </Pressable>
                                <AppText style={styles.shareItemLabel}>Email</AppText>
                            </View>

                            <View style={styles.shareItem}>
                                <Pressable
                                    style={styles.shareItemCircle}
                                    onPress={handleShare}
                                >
                                    <Ionicons
                                        name="share-social"
                                        size={22}
                                        color={COLORS.primary}
                                    />
                                </Pressable>
                                <AppText style={styles.shareItemLabel}>More</AppText>
                            </View>
                        </View>
                    </View>

                    {/* Your Referrals card */}
                    <View style={styles.referralsCard}>
                        <View style={styles.referralsHeaderRow}>
                            <AppText style={styles.referralsTitle}>Your Referrals</AppText>
                            <AppText style={styles.referralsEarned}>
                                ¢{totalEarned.toFixed(2)} Earned
                            </AppText>
                        </View>

                        <View style={styles.progressBarBackground}>
                            <View
                                style={[
                                    styles.progressBarFill,
                                    { width: `${progress * 100}%` },
                                ]}
                            />
                        </View>

                        <View style={styles.referralsFooterRow}>
                            <AppText style={styles.referralsFooterText}>
                                {successfulReferrals} Successful referrals
                                {pendingReferrals > 0 ? ` • ${pendingReferrals} pending` : ""}
                            </AppText>
                            <AppText style={styles.referralsFooterText}>{""}</AppText>
                        </View>
                    </View>

                    <View style={styles.disclaimerContainer}>
                        <AppText style={styles.disclaimerText}>
                            By sharing your link, you agree to our{" "}
                            <AppText
                                style={styles.disclaimerLink}
                                onPress={() => Linking.openURL("https://cleancity.com/terms")}
                            >
                                Referral Terms &amp; Conditions
                            </AppText>
                            . Credits are applied automatically to your next booking.
                        </AppText>
                    </View>
                </ScrollView>
            )}
        </SafeAreaView>
    );
};


