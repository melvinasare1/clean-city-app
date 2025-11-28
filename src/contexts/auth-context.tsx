import React, {
    createContext,
    useContext,
    useEffect,
    useState,
} from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    User as FirebaseUser,
    sendPasswordResetEmail,
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '@/services/firebase/firebase-config';
import { setDocAtPath } from '@/lib/utils';

export type AppUserRole = 'customer' | 'driver';

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

const mapProfile = (firebaseUser: FirebaseUser, data?: { email?: string; role?: AppUserRole | null, phone: string, location: string }): AppUser => {
    return {
        id: firebaseUser.uid,
        email: data?.email ?? firebaseUser.email ?? '',
        phone: data?.phone,
        location: data?.location,
        role: data?.role ?? null,
    };
};

const fetchUserProfile = async (firebaseUser: FirebaseUser): Promise<AppUser> => {
    const ref = doc(db, 'profiles', firebaseUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        return mapProfile(firebaseUser);
    }

    const data = snap.data() as { email?: string; role?: AppUserRole | null, phone: string, location: string };
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
        role: AppUserRole | null = null
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
