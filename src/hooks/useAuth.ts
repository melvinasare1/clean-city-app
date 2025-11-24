import { useState, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "../services/firebase/firebase-config";
import { AppUser } from "../types/user";

interface UseAuthReturn {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  loginWithEmailPassword: (email: string, password: string) => Promise<void>;
  signupWithEmailPassword: (
    email: string,
    password: string,
    role: "customer" | "driver"
  ) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginWithPhoneNumber: (phoneNumber: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          // TODO: In production, fetch the user's role from Firestore
          // For now, we'll use a temporary approach with the RoleSelector screen
          const appUser: AppUser = {
            id: firebaseUser.uid,
            email: firebaseUser.email || "",
            role: "customer", // Temporary default - will be set via RoleSelector
          };
          setUser(appUser);
        } else {
          setUser(null);
        }
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /**
   * Login with email and password
   * TODO: This is ready to use with Firebase Auth
   */
  const loginWithEmailPassword = async (
    email: string,
    password: string
  ): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      // Uncomment this when you've added your Firebase config:
      await signInWithEmailAndPassword(auth, email, password);

      // For testing without Firebase, you can use this placeholder:
      // console.log('Login attempt:', email);
      // setTimeout(() => {
      //   setUser({ id: '123', email, role: 'customer' });
      //   setLoading(false);
      // }, 1000);
    } catch (err: any) {
      setError(err.message || "Login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Sign up with email and password
   * TODO: After creating the user, save their role to Firestore
   */
  const signupWithEmailPassword = async (
    email: string,
    password: string,
    role: "customer" | "driver"
  ): Promise<void> => {
    try {
      setError(null);
      setLoading(true);

      // Create the user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // TODO: Save user profile (including role) to Firestore
      // Example:
      // await setDoc(doc(db, 'users', userCredential.user.uid), {
      //   email,
      //   role,
      //   createdAt: serverTimestamp(),
      // });

      console.log("User created:", userCredential.user.uid, "Role:", role);
    } catch (err: any) {
      setError(err.message || "Signup failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Login with Google
   * TODO: Implement Google Sign-In
   */
  const loginWithGoogle = async (): Promise<void> => {
    try {
      setError(null);
      setLoading(true);
      // TODO: Implement Google Sign-In with Firebase
      console.log("Google login not yet implemented");
      throw new Error("Google login not yet implemented");
    } catch (err: any) {
      setError(err.message || "Google login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Login with Phone Number
   * TODO: Implement Phone Authentication
   */
  const loginWithPhoneNumber = async (phoneNumber: string): Promise<void> => {
    try {
      setError(null);
      setLoading(true);
      // TODO: Implement Phone Authentication with Firebase
      console.log("Phone login not yet implemented", phoneNumber);
      throw new Error("Phone login not yet implemented");
    } catch (err: any) {
      setError(err.message || "Phone login failed");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  /**
   * Logout the current user
   */
  const logout = async (): Promise<void> => {
    try {
      setError(null);
      await signOut(auth);
      setUser(null);
    } catch (err: any) {
      setError(err.message || "Logout failed");
      throw err;
    }
  };

  return {
    user,
    loading,
    error,
    loginWithEmailPassword,
    signupWithEmailPassword,
    loginWithGoogle,
    loginWithPhoneNumber,
    logout,
  };
};
