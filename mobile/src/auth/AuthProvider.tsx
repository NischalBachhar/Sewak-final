import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  activateAccount as activateAccountApi,
  refreshSession,
  registerAccount as registerAccountApi,
  signIn as signInApi,
  signOut as signOutApi,
} from "@/auth/authApi";
import { SewakProfile, SewakUser, UserRole } from "@/types";

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  selectedRole: "user" | "orgadmin";
  organizationName?: string;
};

type AuthValue = {
  user: SewakUser | null;
  profile: SewakProfile | null;
  role: UserRole | null;
  loading: boolean;
  error: string;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  activate: (token: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<SewakUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const apply = (next: SewakUser | null) => {
    setUser(next);
    setError("");
  };

  useEffect(() => {
    let active = true;
    refreshSession()
      .then((next) => {
        if (active) apply(next);
      })
      .catch(() => {
        if (active) {
          setUser(null);
          setError("We could not verify your Sewak session.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      profile: user?.profile || null,
      role: user?.role || null,
      loading,
      error,
      signIn: async (email, password) => {
        setError("");
        apply(await signInApi(email, password));
      },
      register: async (input) => {
        setError("");
        apply(await registerAccountApi(input));
      },
      activate: async (token, password) => {
        setError("");
        apply(await activateAccountApi(token, password));
      },
      signOut: async () => {
        await signOutApi();
        apply(null);
      },
      refresh: async () => {
        apply(await refreshSession());
      },
    }),
    [user, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
