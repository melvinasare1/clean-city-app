import React, { useState } from 'react';
import {
    Alert,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, AppTextInput, ScreenContainer } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { setDocAtPath } from '@/lib/utils';
import { SERVICE_AREAS, ServiceArea } from '@/lib/service-areas';
import { CustomerStackParamList } from '@/navigation/types';
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
    const [isSaving, setIsSaving] = useState(false);
    const [showAreaPicker, setShowAreaPicker] = useState(false);

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

        try {
            setIsSaving(true);
            await setDocAtPath(
                ['profiles', user.id],
                { phone, location },
                { merge: true, addTimestamps: false }
            );
            // Refresh user profile in context to reflect the changes immediately
            await refreshUserProfile();
            Alert.alert('Success', 'Profile updated successfully.');
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
        <ScreenContainer scrollable>
            <View style={styles.form}>
                <AppText style={styles.title}>Complete your profile</AppText>
                <AppText style={styles.description}>
                    Add your contact number and service area so we can coordinate pick-ups
                    without delays.
                </AppText>

                <AppText style={styles.label}>Contact number</AppText>
                <AppTextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="Enter your phone number"
                    style={styles.input}
                />

                <AppText style={styles.label}>Service area</AppText>
                <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setShowAreaPicker(true)}
                >
                    <AppText
                        style={location ? styles.selectText : styles.selectPlaceholder}
                    >
                        {location || 'Select your area'}
                    </AppText>
                </TouchableOpacity>

                <AppText style={styles.helperText}>
                    We currently only cover selected areas in East Legon. We’ll be
                    expanding to more locations soon.
                </AppText>

                <TouchableOpacity
                    style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
                    onPress={handleSave}
                    disabled={isSaving}
                >
                    {isSaving ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <AppText style={styles.saveButtonText}>Save details</AppText>
                    )}
                </TouchableOpacity>
            </View>

            {showAreaPicker && (
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
            )}
        </ScreenContainer>
    );
};


