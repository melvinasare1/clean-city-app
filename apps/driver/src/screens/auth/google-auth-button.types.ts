import type { StyleProp, ViewStyle, TextStyle } from 'react-native';
import type { AuthCredential } from 'firebase/auth';

export type GoogleAuthFlowScreen = 'login' | 'signup';

export type GoogleAuthButtonProps = {
    disabled?: boolean;
    onGoogleCredential: (credential: AuthCredential) => Promise<void>;
    screen: GoogleAuthFlowScreen;
    style?: StyleProp<ViewStyle>;
    textStyle?: StyleProp<TextStyle>;
};
