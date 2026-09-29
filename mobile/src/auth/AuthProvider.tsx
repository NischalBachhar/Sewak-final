import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, firebaseConfigured } from "@/lib/firebase";
import { getMyProfile } from "@/api/sewak";
import { SewakProfile, UserRole } from "@/types";

type AuthValue = {
  user: User | null;
  profile: SewakProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

async function resolveRole(user: User): Promise<UserRole> {
  const result = await user.getIdTokenResult();
  const claim = result.claims.platformRole;
  if (
    claim === "caregiver" ||
    claim === "orgadmin" ||
    claim === "superadmin" ||
    claim === "user"
  ) {
    return claim;
  }
  return "user";
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<SewakProfile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(firebaseConfigured);
  const [error, setError] = useState("");

  const loadProfile = async (activeUser: User) => {
    const trustedRole = await resolveRole(activeUser);
    setRole(trustedRole);

    try {
      const apiProfile = await getMyProfile();
      setProfile(
        apiProfile ?? {
          uid: activeUser.uid,
          name: activeUser.displayName || undefined,
          email: activeUser.email || undefined,
          role: trustedRole,
        },
      );
    } catch {
      setProfile({
        uid: activeUser.uid,
        name: activeUser.displayName || undefined,
        email: activeUser.email || undefined,
        role: trustedRole,
      });
    }
  };

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, async (nextUser) => {
      setLoading(true);
      setError("");
      setUser(nextUser);

      if (!nextUser) {
        setProfile(null);
        setRole(null);
        setLoading(false);
        return;
      }

      try {
        await loadProfile(nextUser);
      } catch {
        setError("We could not verify your Sewak account.");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      profile,
      role,
      loading,
      error,
      signIn: async (email, password) => {
        if (!auth) {
          throw new Error(
            "Firebase Authentication is not configured for the mobile app.",
          );
        }
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      signOut: async () => {
        if (auth) await firebaseSignOut(auth);
      },
      refreshProfile: async () => {
        if (user) await loadProfile(user);
      },
    }),
    [user, profile, role, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
