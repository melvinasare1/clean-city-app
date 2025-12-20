import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - native-only module types
import firestore from '@react-native-firebase/firestore';
import {
    firebaseAuth,
    signIn,
    signUp,
    signOutUser,
    onUserChanged,
    type RNFirebaseUser,
} from '@/lib/firebase';
import { setDocAtPath } from '@/lib/utils';

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

const mapProfile = (firebaseUser: RNFirebaseUser, data?: { email?: string; role?: AppUserRole | null, phone: string | null, location: string | null }): AppUser => {
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
        phone: data?.phone,
        location: data?.location,
        role: data?.role ?? null,
    };
};

const fetchUserProfile = async (firebaseUser: RNFirebaseUser): Promise<AppUser> => {
    if (!firebaseUser) {
        return {
            id: '',
            email: '',
            role: null,
        };
    }

    const ref = firestore().collection('profiles').doc(firebaseUser.uid);
    const snap = await ref.get();

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
        const unsubscribe = onUserChanged(async (firebaseUser) => {
            if (firebaseUser) {
                try {
                    const profile = await fetchUserProfile(firebaseUser);
                    setUser(profile);
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
        await signIn(email, password);
    };

    const signup = async (
        email: string,
        password: string,
        role: AppUserRole | null = 'customer'
    ) => {
        const result = await signUp(email, password);
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
        await firebaseAuth.sendPasswordResetEmail(email);
    };

    const logout = async () => {
        await signOutUser();
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
