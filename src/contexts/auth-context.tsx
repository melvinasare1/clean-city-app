import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from 'react';
import {
    doc,
    getDoc,
} from 'firebase/firestore';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    type User as FirebaseUser,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { setDocAtPath } from '@/lib/utils';
import { registerForPushNotifications, removePushTokenFromFirestore } from '@/lib/push';

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
    resetPassword: (email: string) => Promise<void>;
    signup: (
        email: string,
        password: string,
        role?: AppUserRole | null
    ) => Promise<void>;
    logout: () => Promise<void>;
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

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
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

    const login = async (email: string, password: string) => {
        await signInWithEmailAndPassword(auth, email, password);
    };

    const signup = async (
        email: string,
        password: string,
        role: AppUserRole | null = 'customer'
    ) => {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const firebaseUser = result.user;

        await setDocAtPath(['profiles', firebaseUser.uid], {
            email,
            role,
            phone: null,
            location: null,
        }, {
            merge: true,
            addTimestamps: true,
        });
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
            value={{ user, loading, login, signup, resetPassword, logout }}
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
