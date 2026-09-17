import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
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
import { pickupAddressText } from '@/lib/profile-location';
import type { PickupCoordinates } from '@/lib/profile-location';
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
import { PickupAddressField } from './pickup-address-field';
import { styles } from './complete-profile-screen.styles';

type CompleteProfileScreenProps = NativeStackScreenProps<
    CustomerStackParamList,
    'CompleteProfile'
>;

export const CompleteProfileScreen: React.FC<CompleteProfileScreenProps> = ({
    navigation,
    route,
}) => {
    const { user, refreshUserProfile, mergeLocalProfile } = useAuth();
    const [name, setName] = useState(user?.name ?? '');
    const [phone, setPhone] = useState(user?.phone ?? '');
    const [address, setAddress] = useState(pickupAddressText(user ?? {}));
    const [coords, setCoords] = useState<PickupCoordinates | null>(
        user?.location ?? null
    );
    const [referralInput, setReferralInput] = useState('');
    const [referralError, setReferralError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const { referralWindowOpen } = useReferralWindow(user);

    useLayoutEffect(() => {
        navigation.setOptions({ headerShown: false });
    }, [navigation]);

    useEffect(() => {
        const pickup = route.params?.pickup;
        if (!pickup) return;
        setAddress(pickup.address);
        setCoords(pickup.location);
        navigation.setParams({ pickup: undefined });
    }, [navigation, route.params?.pickup]);

    useEffect(() => {
        if (!user || route.params?.pickup) return;
        if (user.name) setName(user.name);
        if (user.phone) setPhone(user.phone);
        const savedAddress = pickupAddressText(user);
        if (savedAddress) setAddress(savedAddress);
        if (user.location) setCoords(user.location);
    }, [route.params?.pickup, user]);

    const checklistSteps = useMemo(
        () =>
            getProfileCompletionSteps({
                email: user?.email,
                name: name || undefined,
                phone: phone || undefined,
                address: address || undefined,
            }),
        [user?.email, name, phone, address]
    );

    const referralCodeValid = useMemo(
        () => !referralInput || isReferralCodeFormatValid(referralInput),
        [referralInput]
    );

    const canSave =
        !!name &&
        !!phone &&
        !!address &&
        !!coords &&
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

        const trimmedName = name.trim();
        const trimmedPhone = phone.trim();
        const trimmedAddress = address.trim();

        if (!trimmedName || !trimmedPhone || !trimmedAddress || !coords) {
            Alert.alert(
                'Missing info',
                'Please add your name, contact number, and a confirmed pickup address.'
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
                {
                    role: 'customer',
                    name: trimmedName,
                    phone: trimmedPhone,
                    address: trimmedAddress,
                    location: { lat: coords.lat, lng: coords.lng },
                },
                { merge: true, addTimestamps: false }
            );
            mergeLocalProfile({
                name: trimmedName,
                phone: trimmedPhone,
                address: trimmedAddress,
                location: { lat: coords.lat, lng: coords.lng },
            });
            await refreshUserProfile({ fromServer: true });
            navigation.goBack();
        } catch (err) {
            console.error('Error updating profile:', err);
            const message =
                err instanceof Error && /permission/i.test(err.message)
                    ? 'You do not have permission to update this profile. Please sign in again and try.'
                    : 'Could not update your profile. Please try again later.';
            Alert.alert('Error', message);
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
                    <AppText style={styles.label}>Full name</AppText>
                    <AppTextInput
                        value={name}
                        onChangeText={setName}
                        autoCapitalize="words"
                        autoCorrect={false}
                        placeholder="Jane Mensah"
                        style={styles.input}
                    />

                    <AppText style={styles.label}>Phone number</AppText>
                    <AppTextInput
                        value={phone}
                        onChangeText={setPhone}
                        keyboardType="phone-pad"
                        placeholder="+233 24 000 0000"
                        style={styles.input}
                    />

                    <AppText style={styles.label}>Pickup address</AppText>
                    <PickupAddressField
                        address={address}
                        location={coords}
                        onPress={() =>
                            navigation.navigate('SetPickupLocation', {
                                initialAddress: address,
                                initialLocation: coords,
                            })
                        }
                    />
                    <AppText style={styles.helperText}>
                        Open the map, search or pan to your building entrance, then confirm.
                        We save the spot under the center pin.
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
        </ScreenContainer>
    );
};
