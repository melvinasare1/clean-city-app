import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
} from 'react';
import { Platform } from 'react-native';
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
import { signOutGoogleSession } from '@/lib/google-session';
import { ensureGoogleSignInConfigured } from '@/lib/google-signin-config';
import { setDocAtPath } from '@/lib/utils';
import { registerForPushNotifications, removePushTokenFromFirestore } from '@/lib/push';
import { loadReminderSettingsAndReschedule, loadWeeklyReminderSettingsAndReschedule } from '@/lib/reminders';
import { createReferralIfValid } from '@/services/referralService';
import { registerDriverAccount } from '@/services/driver-api';
import { isProfileComplete, toMillis } from '@/lib/referral-utils';

export type AppUserRole = 'customer' | 'driver' | 'admin';

export interface AppUser {
    id: string;
    email: string;
    role: AppUserRole | null;
    phone?: string;
    location?: string;
    signupAt?: string;
    referralCodeUsed?: string | null;
    referralCodeApplied?: boolean;
    firstBookingAt?: string | null;
    profileComplete?: boolean;
    referralCode?: string;
    referralStats?: {
        friendsReferred: number;
        freePickupsEarned: number;
        freePickupThreshold: number;
    };
}

interface AuthContextProps {
    user: AppUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithCredential: (credential: AuthCredential, role?: AppUserRole | null) => Promise<void>;
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

type ProfileData = {
    email?: string;
    role?: AppUserRole | null;
    phone?: string | null;
    location?: string | null;
    createdAt?: unknown;
    referredBy?: string | null;
    referralCodeUsed?: string | null;
    referralCodeApplied?: boolean;
    firstBookingAt?: unknown;
    referralCode?: string;
};

const mapProfile = (firebaseUser: FirebaseUser | null, data?: ProfileData): AppUser => {
    if (!firebaseUser) {
        return {
            id: '',
            email: '',
            role: null,
        };
    }

    const phone = data?.phone ?? undefined;
    const location = data?.location ?? undefined;
    const signupMs =
        toMillis(data?.createdAt) ??
        (firebaseUser.metadata.creationTime
            ? new Date(firebaseUser.metadata.creationTime).getTime()
            : null);
    const firstBookingMs = toMillis(data?.firstBookingAt);

    return {
        id: firebaseUser.uid,
        email: data?.email ?? firebaseUser.email ?? '',
        phone: phone || undefined,
        location: location || undefined,
        role: data?.role ?? null,
        signupAt: signupMs ? new Date(signupMs).toISOString() : undefined,
        referralCodeUsed: data?.referralCodeUsed ?? data?.referredBy ?? null,
        referralCodeApplied: data?.referralCodeApplied === true,
        firstBookingAt: firstBookingMs ? new Date(firstBookingMs).toISOString() : null,
        profileComplete: isProfileComplete({ phone: phone || undefined, location: location || undefined }),
        referralCode:
            typeof data?.referralCode === 'string'
                ? data.referralCode
                : `CC-${firebaseUser.uid.slice(0, 6).toUpperCase()}`,
    };
};

const mapDriver = (firebaseUser: FirebaseUser | null, data?: Record<string, unknown>): AppUser => {
    if (!firebaseUser) {
        return { id: '', email: '', role: null };
    }
    return {
        id: firebaseUser.uid,
        email: (typeof data?.email === 'string' && data.email.trim()) ? data.email : (firebaseUser.email ?? ''),
        role: 'driver',
    };
};

/**
 * Create profiles/{uid} for first-time *customer* social sign-in (Apple, Google) and other auth paths.
 * For drivers we avoid creating profiles; driver data should live in drivers/{uid}.
 */
const createProfileIfMissing = async (firebaseUser: FirebaseUser): Promise<void> => {
    // If a driver document already exists, do not create a customer profile for the same UID.
    try {
        const driverSnap = await getDoc(doc(db, 'drivers', firebaseUser.uid));
        if (driverSnap.exists()) return;
    } catch {
        // If drivers read permissions are not deployed yet, continue creating the customer profile.
    }

    const docRef = doc(db, 'profiles', firebaseUser.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) return;

    const generatedReferralCode = `CC-${firebaseUser.uid.slice(0, 6).toUpperCase()}`;
    await setDocAtPath(
        ['profiles', firebaseUser.uid],
        {
            email: firebaseUser.email ?? '',
            role: 'customer' as AppUserRole,
            phone: null,
            location: null,
            referralCode: generatedReferralCode,
            referredBy: null,
            creditBalance: 0,
            referralRewarded: false,
        },
        { merge: true, addTimestamps: true }
    );
};

const fetchUserProfile = async (firebaseUser: FirebaseUser | null): Promise<AppUser> => {
    if (!firebaseUser) {
        return {
            id: '',
            email: '',
            role: null,
        };
    }

    // Driver data should live in drivers/{uid}. If a driver doc exists, return driver role.
    try {
        const driverSnap = await getDoc(doc(db, 'drivers', firebaseUser.uid));
        if (driverSnap.exists()) {
            return mapDriver(firebaseUser, driverSnap.data() as Record<string, unknown> | undefined);
        }
    } catch {
        // Fall back to profiles below.
    }

    // Otherwise treat the account as a customer and ensure profiles/{uid} exists.
    await createProfileIfMissing(firebaseUser);

    const docRef = doc(db, 'profiles', firebaseUser.uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
        return mapProfile(firebaseUser);
    }

    let data = snap.data() as ProfileData | undefined;

    if (data && typeof data.referralCode !== 'string') {
        const generatedReferralCode = `CC-${firebaseUser.uid.slice(0, 6).toUpperCase()}`;
        await setDocAtPath(
            ['profiles', firebaseUser.uid],
            { referralCode: generatedReferralCode },
            { merge: true, addTimestamps: false }
        );
        data = { ...data, referralCode: generatedReferralCode };
    }

    return mapProfile(firebaseUser, data);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentFirebaseUser, setCurrentFirebaseUser] = useState<FirebaseUser | null>(null);

    useEffect(() => {
        if (Platform.OS !== 'web') {
            ensureGoogleSignInConfigured();
        }
    }, []);

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

    const loginWithCredential = async (credential: AuthCredential, role?: AppUserRole | null) => {
        const result = await signInWithCredential(auth, credential);

        // Social sign-in should create the correct collection for the selected role.
        // Drivers must be created in drivers/{uid}, not profiles/{uid}.
        if (role === 'driver') {
            const email = result.user.email;
            if (!email) {
                throw new Error('Social sign-in did not return an email; cannot create driver account.');
            }
            await registerDriverAccount(result.user.uid, email);
            return;
        }

        // Customer flow (or existing login without a role hint)
        await createProfileIfMissing(result.user);
    };

    const signup = async (
        email: string,
        password: string,
        role: AppUserRole | null = 'customer',
        referralCode: string | null = null
    ) => {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = result.user;

        const isDriver = role === 'driver';

        if (isDriver) {
            // Drivers must be created under drivers/{uid}; do not create driver data in profiles/{uid}.
            await registerDriverAccount(firebaseUser.uid, email);
            return;
        }

        // Customer flow: create / update profiles/{uid} with referral-related defaults.
        const generatedReferralCode = `CC-${firebaseUser.uid.slice(0, 6).toUpperCase()}`;
        await setDocAtPath(['profiles', firebaseUser.uid], {
            email,
            role: 'customer',
            phone: null,
            location: null,
            referralCode: generatedReferralCode,
            referredBy: null,
            referralCodeUsed: null,
            referralCodeApplied: false,
            creditBalance: 0,
            referralRewarded: false,
        }, {
            merge: true,
            addTimestamps: true,
        });

        // Create pending referral document if the supplied code is valid.
        if (referralCode && referralCode.trim()) {
            const trimmed = referralCode.trim().toUpperCase();
            await createReferralIfValid({
                newUserId: firebaseUser.uid,
                newUserEmail: email,
                referralCode: trimmed,
            });

            const referralSnap = await getDoc(doc(db, 'referrals', firebaseUser.uid));
            if (referralSnap.exists()) {
                await setDocAtPath(['profiles', firebaseUser.uid], {
                    referredBy: trimmed,
                    referralCodeUsed: trimmed,
                    referralCodeApplied: true,
                    referralDiscount: {
                        type: 'percent',
                        value: 10,
                        appliesTo: 'first_booking',
                    },
                }, { merge: true, addTimestamps: false });
            }
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
        await signOutGoogleSession();
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
