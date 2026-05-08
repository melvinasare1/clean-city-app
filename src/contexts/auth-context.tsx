import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
} from 'react';
import {
    doc,
    getDoc,
} from 'firebase/firestore';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithCredential,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    type AuthCredential,
    type User as FirebaseUser,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { setDocAtPath } from '@/lib/utils';
import { registerForPushNotifications, removePushTokenFromFirestore } from '@/lib/push';
import { loadReminderSettingsAndReschedule, loadWeeklyReminderSettingsAndReschedule } from '@/lib/reminders';
import { createReferralIfValid } from '@/services/referralService';

export type AppUserRole = 'customer' | 'driver' | 'admin';

export interface AppUser {
    id: string;
    email: string;
    role: AppUserRole | null;
    phone?: string
    location?: string
}

interface AuthContextProps {
    user: AppUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithCredential: (credential: AuthCredential) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    signup: (
        email: string,
        password: string,
        role?: AppUserRole | null,
        referralCode?: string | null
    ) => Promise<void>;
    logout: () => Promise<void>;
    refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

const mapProfile = (firebaseUser: FirebaseUser | null, data?: { email?: string; role?: AppUserRole | null, phone: string | null, location: string | null }): AppUser => {
    if (!firebaseUser) {
        return {
            id: '',
            email: '',
            role: null,
        };
    }
    return {
        id: firebaseUser.uid,
        email: data?.email ?? firebaseUser.email ?? '',
        phone: data?.phone ?? undefined,
        location: data?.location ?? undefined,
        role: data?.role ?? null,
    };
};

const fetchUserProfile = async (firebaseUser: FirebaseUser | null): Promise<AppUser> => {
    if (!firebaseUser) {
        return {
            id: '',
            email: '',
            role: null,
        };
    }

    const docRef = doc(db, 'profiles', firebaseUser.uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
        return mapProfile(firebaseUser);
    }

    const data = snap.data() as { email?: string; role?: AppUserRole | null, phone: string | null, location: string | null } | undefined;
    return mapProfile(firebaseUser, data);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentFirebaseUser, setCurrentFirebaseUser] = useState<FirebaseUser | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setCurrentFirebaseUser(firebaseUser);
            if (firebaseUser) {
                try {
                    const profile = await fetchUserProfile(firebaseUser);
                    setUser(profile);
                    
                    // Register for push notifications after successful login
                    // This runs in the background and won't block the auth flow
                    registerForPushNotifications(firebaseUser.uid).catch((err) => {
                        console.error('Failed to register push notifications:', err);
                        // Don't throw - push registration failure shouldn't break auth
                    });

                    // Load and reschedule daily reminders after successful login
                    // This restores reminders after reinstall or device change
                    loadReminderSettingsAndReschedule(firebaseUser.uid).catch((err) => {
                        console.error('Failed to load reminder settings:', err);
                        // Don't throw - reminder loading failure shouldn't break auth
                    });

                    // Load and reschedule weekly reminders after successful login
                    // This restores weekly rubbish collection reminders after reinstall or device change
                    loadWeeklyReminderSettingsAndReschedule(firebaseUser.uid).catch((err) => {
                        console.error('Failed to load weekly reminder settings:', err);
                        // Don't throw - reminder loading failure shouldn't break auth
                    });
                } catch (err) {
                    console.error('Error fetching user profile:', err);
                    setUser({
                        id: firebaseUser.uid,
                        email: firebaseUser.email ?? '',
                        role: null,
                    });
                }
            } else {
                setUser(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const refreshUserProfile = useCallback(async () => {
        if (currentFirebaseUser) {
            try {
                const profile = await fetchUserProfile(currentFirebaseUser);
                setUser(profile);
            } catch (err) {
                console.error('Error refreshing user profile:', err);
            }
        }
    }, [currentFirebaseUser]);

    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const loginWithCredential = async (credential: AuthCredential) => {
        const result = await signInWithCredential(auth, credential);
        const firebaseUser = result.user;

        const docRef = doc(db, 'profiles', firebaseUser.uid);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            const generatedReferralCode = `CC-${firebaseUser.uid.slice(0, 6).toUpperCase()}`;
            await setDocAtPath(['profiles', firebaseUser.uid], {
                email: firebaseUser.email ?? '',
                role: 'customer' as AppUserRole,
                phone: null,
                location: null,
                referralCode: generatedReferralCode,
                referredBy: null,
                creditBalance: 0,
                referralRewarded: false,
            }, { merge: true, addTimestamps: true });
        }
    };

    const signup = async (
        email: string,
        password: string,
        role: AppUserRole | null = 'customer',
        referralCode: string | null = null
    ) => {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = result.user;

        const generatedReferralCode = `CC-${firebaseUser.uid.slice(0, 6).toUpperCase()}`;

        // Always create / update the user profile with referral-related defaults.
        await setDocAtPath(['profiles', firebaseUser.uid], {
            email,
            role,
            phone: null,
            location: null,
            referralCode: generatedReferralCode,
            referredBy: referralCode?.trim() || null,
            creditBalance: 0,
            referralRewarded: false,
        }, {
            merge: true,
            addTimestamps: true,
        });

        // Create pending referral document if the supplied code is valid.
        if (referralCode && referralCode.trim()) {
            await createReferralIfValid({
                newUserId: firebaseUser.uid,
                newUserEmail: email,
                referralCode: referralCode.trim(),
            });
        }
    };

    const resetPassword = async (email: string) => {
        await sendPasswordResetEmail(auth, email);
    };

    const logout = async () => {
        // Remove push token from Firestore before signing out
        const currentUser = auth.currentUser;
        if (currentUser) {
            try {
                await removePushTokenFromFirestore(currentUser.uid);
            } catch (err) {
                console.error('Failed to remove push token on logout:', err);
                // Don't throw - continue with logout even if token removal fails
            }
        }
        await signOut(auth);
    };

    return (
        <AuthContext.Provider
            value={{ user, loading, login, loginWithCredential, signup, resetPassword, logout, refreshUserProfile }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuthContext = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuthContext must be used inside AuthProvider');
    }
    return ctx;
};
