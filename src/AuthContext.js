import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { createFallbackUserDoc, resolveInitialUserRole } from "./authUtils";

const AuthContext = createContext({
  user: null,
  loading: true,
  userRole: null,
  userDoc: null,
  userData: null,
  refreshUserDoc: null,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUserDoc = async () => {
    if (!user) return;
    try {
      let docSnap;

      // Try to determine the collection based on current role
      if (userRole === "orgadmin") {
        docSnap = await getDoc(doc(db, "organizations", user.uid));
      } else if (userRole === "caregiver") {
        docSnap = await getDoc(doc(db, "vendors", user.uid));
      } else {
        docSnap = await getDoc(doc(db, "users", user.uid));
      }

      // If not found in primary collection, try other collections
      if (!docSnap.exists()) {
        docSnap = await getDoc(doc(db, "users", user.uid));
      }
      if (!docSnap.exists()) {
        docSnap = await getDoc(doc(db, "organizations", user.uid));
      }
      if (!docSnap.exists()) {
        docSnap = await getDoc(doc(db, "vendors", user.uid));
      }

      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserRole(data.role);

        // For orgadmin, also fetch organization data and merge
        if (data.role === "orgadmin") {
          try {
            const orgSnap = await getDoc(doc(db, "organizations", user.uid));
            if (orgSnap.exists()) {
              const orgData = orgSnap.data();
              const mergedData = { ...data, ...orgData };
              setUserDoc(mergedData);
              setUserData(mergedData);
            } else {
              setUserDoc(data);
              setUserData(data);
            }
          } catch (err) {
            if (
              err.code === "permission-denied" ||
              err.message?.includes("Missing or insufficient permissions")
            ) {
              console.warn(
                "[AuthContext] Orgadmin cannot read organizations/ doc; using base user data only.",
              );
            } else {
              console.error("Error fetching organization data:", err);
            }
            setUserDoc(data);
            setUserData(data);
          }
        } else {
          setUserDoc(data);
          setUserData(data);
        }
      }
    } catch (err) {
      console.error("Error refreshing user data:", err);
    }
  };

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        try {
          let docSnap = null;
          let resolvedRole = "user";

          try {
            docSnap = await getDoc(doc(db, "users", u.uid));
          } catch (err) {
            console.warn("[AuthContext] Unable to read users profile, trying others:", err);
          }

          if (!docSnap?.exists()) {
            try {
              docSnap = await getDoc(doc(db, "organizations", u.uid));
            } catch (err) {
              console.warn("[AuthContext] Unable to read organizations profile:", err);
            }
          }

          if (!docSnap?.exists()) {
            try {
              docSnap = await getDoc(doc(db, "vendors", u.uid));
            } catch (err) {
              console.warn("[AuthContext] Unable to read vendors profile:", err);
            }
          }

          if (docSnap?.exists()) {
            const data = docSnap.data();
            resolvedRole = resolveInitialUserRole(data);
            setUserRole(resolvedRole);

            if (resolvedRole === "orgadmin") {
              try {
                const orgSnap = await getDoc(doc(db, "organizations", u.uid));
                if (orgSnap.exists()) {
                  const orgData = orgSnap.data();
                  const mergedData = { ...data, ...orgData };
                  setUserDoc(mergedData);
                  setUserData(mergedData);
                } else {
                  setUserDoc(data);
                  setUserData(data);
                }
              } catch (err) {
                if (
                  err.code === "permission-denied" ||
                  err.message?.includes("Missing or insufficient permissions")
                ) {
                  console.warn(
                    "[AuthContext] Orgadmin cannot read organizations/ doc; using base user data only.",
                  );
                } else {
                  console.error("Error fetching organization data:", err);
                }
                setUserDoc(data);
                setUserData(data);
              }
            } else {
              setUserDoc(data);
              setUserData(data);
            }
          } else {
            const fallbackDoc = createFallbackUserDoc(u);
            setUserRole(fallbackDoc.role);
            setUserDoc(fallbackDoc);
            setUserData(fallbackDoc);
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
          const fallbackDoc = createFallbackUserDoc(u);
          setUserRole(fallbackDoc.role);
          setUserDoc(fallbackDoc);
          setUserData(fallbackDoc);
        }
      } else {
        setUserRole(null);
        setUserDoc(null);
        setUserData(null);
      }
      setLoading(false);
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, userRole, userDoc, userData, refreshUserDoc }}
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
