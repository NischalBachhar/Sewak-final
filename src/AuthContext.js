import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import {
  createFallbackUserDoc,
  resolveInitialUserRole,
  resolveTrustedPlatformRole,
} from "./authUtils";

const PROFILE_COLLECTIONS = ["users", "organizations", "vendors"];
const ACCOUNT_ACCESS_ERROR =
  "We couldn't verify your account access. Refresh the page, then sign in again if the problem continues.";

const AuthContext = createContext({
  user: null,
  loading: true,
  userRole: null,
  userDoc: null,
  userData: null,
  accountError: "",
  refreshUserDoc: null,
});

const isPermissionDenied = (error) =>
  error?.code === "permission-denied" ||
  error?.message?.includes("Missing or insufficient permissions");

async function getTrustedRole(user) {
  try {
    const token = await user.getIdTokenResult();
    return resolveTrustedPlatformRole(token?.claims);
  } catch (error) {
    // A temporary token-read failure must not turn a privileged account into a
    // customer account. We still try its private profile as a legacy fallback.
    console.warn("[AuthContext] Unable to read platform role claim:", error);
    return null;
  }
}

async function loadFirstExistingProfile(uid) {
  let permissionDenied = false;

  for (const collectionName of PROFILE_COLLECTIONS) {
    try {
      const snapshot = await getDoc(doc(db, collectionName, uid));
      if (snapshot.exists()) {
        return {
          data: snapshot.data(),
          permissionDenied,
        };
      }
    } catch (error) {
      permissionDenied = permissionDenied || isPermissionDenied(error);
      console.warn(
        `[AuthContext] Unable to read ${collectionName} profile:`,
        error,
      );
    }
  }

  return { data: null, permissionDenied };
}

async function mergeOrganizationProfile(user, role, profileData) {
  const baseProfile = {
    ...(profileData || createFallbackUserDoc(user, { role })),
    role,
  };

  if (role !== "orgadmin") {
    return baseProfile;
  }

  try {
    const organizationSnapshot = await getDoc(
      doc(db, "organizations", user.uid),
    );
    if (organizationSnapshot.exists()) {
      return {
        ...baseProfile,
        ...organizationSnapshot.data(),
        role,
      };
    }
  } catch (error) {
    if (isPermissionDenied(error)) {
      console.warn(
        "[AuthContext] Organization profile is unavailable; using the account profile.",
      );
    } else {
      console.error("[AuthContext] Error fetching organization profile:", error);
    }
  }

  return baseProfile;
}

async function resolveAccountProfile(firebaseUser) {
  const trustedRole = await getTrustedRole(firebaseUser);
  const { data: profileData, permissionDenied } =
    await loadFirstExistingProfile(firebaseUser.uid);
  const role = trustedRole || resolveInitialUserRole(profileData);

  // A signed custom claim remains the routing source of truth when a private
  // profile read is temporarily denied. Do not silently send a caregiver or
  // administrator into the customer browse route.
  if (!profileData && !trustedRole && permissionDenied) {
    return { accountError: ACCOUNT_ACCESS_ERROR };
  }

  const profile = await mergeOrganizationProfile(
    firebaseUser,
    role,
    profileData,
  );

  return {
    role,
    profile,
    accountError: "",
  };
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [userData, setUserData] = useState(null);
  const [accountError, setAccountError] = useState("");
  const [loading, setLoading] = useState(true);

  const refreshUserDoc = async () => {
    if (!user) return;

    const resolved = await resolveAccountProfile(user);
    if (resolved.accountError) {
      setAccountError(resolved.accountError);
      return;
    }

    setAccountError("");
    setUserRole(resolved.role);
    setUserDoc(resolved.profile);
    setUserData(resolved.profile);
  };

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;

      setUser(firebaseUser);
      setLoading(true);
      setAccountError("");

      if (!firebaseUser) {
        setUserRole(null);
        setUserDoc(null);
        setUserData(null);
        setLoading(false);
        return;
      }

      try {
        const resolved = await resolveAccountProfile(firebaseUser);
        if (cancelled) return;

        if (resolved.accountError) {
          setUserRole(null);
          setUserDoc(null);
          setUserData(null);
          setAccountError(resolved.accountError);
        } else {
          setUserRole(resolved.role);
          setUserDoc(resolved.profile);
          setUserData(resolved.profile);
        }
      } catch (error) {
        console.error("[AuthContext] Error resolving account profile:", error);
        if (!cancelled) {
          setUserRole(null);
          setUserDoc(null);
          setUserData(null);
          setAccountError(ACCOUNT_ACCESS_ERROR);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        userRole,
        userDoc,
        userData,
        accountError,
        refreshUserDoc,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
