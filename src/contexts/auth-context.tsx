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
import { type DriverAccountStatus, normalizeDriverStatus } from '@/lib/driver-account';

export type AppUserRole = 'customer' | 'driver' | 'admin';

export interface DriverSignupDetails {
    name?: string;
    phone?: string;
}

export interface AppUser {
    id: string;
    email: string;
    role: AppUserRole | null;
    name?: string;
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
    /** Set when role === 'driver' */
    driverStatus?: DriverAccountStatus;
}

interface AuthContextProps {
    user: AppUser | null;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    loginWithCredential: (
        credential: AuthCredential,
        role?: AppUserRole | null,
        driverDetails?: DriverSignupDetails
    ) => Promise<void>;
    resetPassword: (email: string) => Promise<void>;
    signup: (
        email: string,
        password: string,
        role?: AppUserRole | null,
        referralCode?: string | null,
        driverDetails?: DriverSignupDetails
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
    const status = normalizeDriverStatus(data);
    return {
        id: firebaseUser.uid,
        email:
            typeof data?.email === 'string' && data.email.trim()
                ? data.email
                : firebaseUser.email ?? '',
        name: typeof data?.name === 'string' ? data.name : undefined,
        phone: typeof data?.phone === 'string' ? data.phone : undefined,
        role: 'driver',
        driverStatus: status,
    };
};

/**
 * Create profiles/{uid} for first-time customer sign-in only.
 * Never creates a profile if drivers/{uid} exists.
 */
const createProfileIfMissing = async (firebaseUser: FirebaseUser): Promise<void> => {
    const driverSnap = await getDoc(doc(db, 'drivers', firebaseUser.uid));
    if (driverSnap.exists()) {
        return;
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

    const driverSnap = await getDoc(doc(db, 'drivers', firebaseUser.uid));
    if (driverSnap.exists()) {
        const driverData = driverSnap.data() as Record<string, unknown>;
        if (driverData?.role === 'driver') {
            return mapDriver(firebaseUser, driverData);
        }
    }

    await createProfileIfMissing(firebaseUser);

    const docRef = doc(db, 'profiles', firebaseUser.uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
        return mapProfile(firebaseUser);
    }

    let data = snap.data() as ProfileData | undefined;

    if (data?.role === 'driver') {
        return mapProfile(firebaseUser, { ...data, role: 'customer' });
    }

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

                    registerForPushNotifications(firebaseUser.uid, profile.role).catch((err) => {
                        console.error('Failed to register push notifications:', err);
                    });

                    if (profile.role !== 'driver') {
                        loadReminderSettingsAndReschedule(firebaseUser.uid).catch((err) => {
                            console.error('Failed to load reminder settings:', err);
                        });

                        loadWeeklyReminderSettingsAndReschedule(firebaseUser.uid).catch((err) => {
                            console.error('Failed to load weekly reminder settings:', err);
                        });
                    }
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

    const loginWithCredential = async (
        credential: AuthCredential,
        role?: AppUserRole | null,
        driverDetails?: DriverSignupDetails
    ) => {
        const result = await signInWithCredential(auth, credential);

        if (role === 'driver') {
            const email = result.user.email;
            if (!email) {
                throw new Error('Social sign-in did not return an email; cannot create driver account.');
            }
            await registerDriverAccount({
                userId: result.user.uid,
                email,
                name: driverDetails?.name,
                phone: driverDetails?.phone,
            });
            return;
        }

        await createProfileIfMissing(result.user);
    };

    const signup = async (
        email: string,
        password: string,
        role: AppUserRole | null = 'customer',
        referralCode: string | null = null,
        driverDetails?: DriverSignupDetails
    ) => {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = result.user;

        if (role === 'driver') {
            await registerDriverAccount({
                userId: firebaseUser.uid,
                email,
                name: driverDetails?.name,
                phone: driverDetails?.phone,
            });
            return;
        }

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
        const currentUser = auth.currentUser;
        const roleHint = user?.role;
        if (currentUser) {
            try {
                await removePushTokenFromFirestore(currentUser.uid, roleHint);
            } catch (err) {
                console.error('Failed to remove push token on logout:', err);
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
