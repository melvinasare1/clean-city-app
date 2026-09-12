import React, { useLayoutEffect, useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { AppText, AppTextInput, ScreenContainer } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { useReferralWindow } from '@/hooks/useReferralWindow';
import { setDocAtPath } from '@/lib/utils';
import { SERVICE_AREAS, ServiceArea } from '@/lib/service-areas';
import { CustomerStackParamList } from '@/navigation/types';
import {
    getProfileCompletionSteps,
    getReferralErrorMessage,
    isReferralCodeFormatValid,
    normalizeReferralCodeInput,
    sanitizeReferralCodeInput,
    REFERRAL_CODE_MAX_LENGTH,
} from '@/lib/referral-utils';
import { applyReferralCode } from '@/services/referral-api';
import type { ReferralApplyErrorCode } from '@/types/referral';
import { COLORS, VARS } from '@/lib/constants';
import { styles } from './complete-profile-screen.styles';

type CompleteProfileScreenProps = NativeStackScreenProps<
    CustomerStackParamList,
    'CompleteProfile'
>;

export const CompleteProfileScreen: React.FC<CompleteProfileScreenProps> = ({
    navigation,
}) => {
    const { user, refreshUserProfile } = useAuth();
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [location, setLocation] = useState<ServiceArea | ''>(
        (user?.location as ServiceArea) ?? ''
    );
    const [referralInput, setReferralInput] = useState('');
    const [referralError, setReferralError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showAreaPicker, setShowAreaPicker] = useState(false);

    const { referralWindowOpen } = useReferralWindow(user);

    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    const checklistSteps = useMemo(
        () =>
            getProfileCompletionSteps({
                email: user?.email,
                phone: phone || undefined,
                location: location || undefined,
            }),
        [user?.email, phone, location]
    );

    const referralCodeValid = useMemo(
        () => !referralInput || isReferralCodeFormatValid(referralInput),
        [referralInput]
    );

    const canSave =
        !!phone &&
        !!location &&
        (!referralInput || referralCodeValid) &&
        !isSaving;

    const handleReferralInputChange = (value: string) => {
        setReferralInput(sanitizeReferralCodeInput(value));
        setReferralError(null);
    };

    const handleSave = async () => {
        if (!user) {
            Alert.alert(
                'Error',
                'You need to be logged in to update your profile. Please sign in again.'
            );
            return;
        }

        if (!phone || !location) {
            Alert.alert(
                'Missing info',
                'Please add both a contact number and your service area.'
            );
            return;
        }

        if (referralInput && !isReferralCodeFormatValid(referralInput)) {
            return;
        }

        try {
            setIsSaving(true);
            setReferralError(null);

            if (referralWindowOpen && referralInput.trim()) {
                const result = await applyReferralCode(
                    normalizeReferralCodeInput(referralInput)
                );

                if (!result.success) {
                    const code = result.error as ReferralApplyErrorCode | undefined;
                    if (code) {
                        setReferralError(getReferralErrorMessage(code));
                        return;
                    }
                    setReferralError('Something went wrong. Please try again.');
                    return;
                }
            }

            await setDocAtPath(
                ['profiles', user.id],
                { phone, location },
                { merge: true, addTimestamps: false }
            );
            await refreshUserProfile();
            navigation.goBack();
        } catch (err) {
            console.error('Error updating profile:', err);
            Alert.alert(
                'Error',
                'Could not update your profile. Please try again later.'
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ScreenContainer style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.headerRow}>
                    <View style={styles.headerMain}>
                        <TouchableOpacity
                            onPress={() => navigation.goBack()}
                            hitSlop={12}
                            style={{ marginBottom: VARS.medium }}
                        >
                            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
                        </TouchableOpacity>
                        <AppText style={styles.title}>Complete profile</AppText>
                    </View>
                    <View style={styles.unlockBadge}>
                        <Ionicons name="lock-open-outline" size={14} color={COLORS.success} />
                        <AppText style={styles.unlockBadgeText}>Unlock booking</AppText>
                    </View>
                </View>

                <View style={styles.checklist}>
                    {checklistSteps.map((step) => (
                        <View key={step.label} style={styles.checklistItem}>
                            <View
                                style={[
                                    styles.checklistCircle,
                                    step.complete && styles.checklistCircleComplete,
                                ]}
                            >
                                {step.complete ? (
                                    <Ionicons name="checkmark" size={14} color={COLORS.white} />
                                ) : null}
                            </View>
                            <AppText
                                style={[
                                    styles.checklistText,
                                    step.complete && styles.checklistTextComplete,
                                ]}
                            >
                                {step.label}
                            </AppText>
                        </View>
                    ))}
                </View>

                <View style={styles.form}>
                    <AppText style={styles.label}>Phone number</AppText>
                    <AppTextInput
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        placeholder="+233 24 000 0000"
                        style={styles.input}
                    />

                    <AppText style={styles.label}>Pickup location</AppText>
                    <TouchableOpacity
                        style={styles.selectInput}
                        onPress={() => setShowAreaPicker(true)}
                    >
                        <AppText
                            style={
                                location ? styles.selectText : styles.selectPlaceholder
                            }
                        >
                            {location || 'Search your address or area'}
                        </AppText>
                    </TouchableOpacity>

                    <AppText style={styles.helperText}>
                        We currently only cover selected areas in East Legon. We'll be
                        expanding to more locations soon.
                    </AppText>

                    {referralWindowOpen ? (
                        <View style={styles.referralCard}>
                            <View style={styles.referralHeaderRow}>
                                <View style={styles.referralIconBox}>
                                    <Ionicons name="gift" size={20} color={COLORS.white} />
                                </View>
                                <AppText style={styles.referralTitle}>
                                    Got a referral code?
                                </AppText>
                            </View>
                            <AppText style={styles.referralSubtext}>
                                Enter a friend's code and get{' '}
                                <AppText style={styles.referralSubtextHighlight}>
                                    10% off your first pickup
                                </AppText>
                            </AppText>
                            <AppTextInput
                                value={referralInput}
                                onChangeText={handleReferralInputChange}
                                placeholder="e.g. CC-ABC123"
                                autoCapitalize="characters"
                                autoCorrect={false}
                                maxLength={REFERRAL_CODE_MAX_LENGTH}
                                style={styles.referralInput}
                            />
                            {referralError ? (
                                <AppText style={styles.referralError}>{referralError}</AppText>
                            ) : null}
                            <TouchableOpacity
                                style={styles.skipLink}
                                onPress={() => {
                                    setReferralInput('');
                                    setReferralError(null);
                                }}
                            >
                                <AppText style={styles.skipLinkText}>Skip for now</AppText>
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <TouchableOpacity
                        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
                        onPress={handleSave}
                        disabled={!canSave}
                    >
                        {isSaving ? (
                            <ActivityIndicator color={COLORS.white} />
                        ) : (
                            <AppText style={styles.saveButtonText}>Save and continue</AppText>
                        )}
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {showAreaPicker ? (
                <View style={styles.areaModalOverlay}>
                    <View style={styles.areaModal}>
                        <AppText style={styles.modalTitle}>Select your area</AppText>

                        {SERVICE_AREAS.map((areaOption) => (
                            <TouchableOpacity
                                key={areaOption}
                                style={styles.areaOption}
                                onPress={() => {
                                    setLocation(areaOption);
                                    setShowAreaPicker(false);
                                }}
                            >
                                <AppText style={styles.areaOptionText}>{areaOption}</AppText>
                            </TouchableOpacity>
                        ))}

                        <TouchableOpacity
                            style={styles.modalCancel}
                            onPress={() => setShowAreaPicker(false)}
                        >
                            <AppText style={styles.modalCancelText}>Cancel</AppText>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}
        </ScreenContainer>
    );
};
