import React from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components';

const ICON_SIZE = 20;

type SocialProvider = 'google' | 'apple';

type SocialButtonLabelProps = {
    provider: SocialProvider;
    label: string;
    textStyle?: StyleProp<TextStyle>;
    iconColor?: string;
};

const PROVIDER_ICON: Record<SocialProvider, keyof typeof Ionicons.glyphMap> = {
    google: 'logo-google',
    apple: 'logo-apple',
};

const DEFAULT_ICON_COLOR: Record<SocialProvider, string> = {
    google: '#4285F4',
    apple: '#FFFFFF',
};

export function SocialButtonLabel({
    provider,
    label,
    textStyle,
    iconColor,
}: SocialButtonLabelProps) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons
                name={PROVIDER_ICON[provider]}
                size={ICON_SIZE}
                color={iconColor ?? DEFAULT_ICON_COLOR[provider]}
            />
            <AppText style={textStyle}>{label}</AppText>
        </View>
    );
}
