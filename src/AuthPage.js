import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import "./AuthPage.css";

const GENERIC_SIGN_IN_ERROR =
  "The email or password is incorrect. Please try again.";

const getAuthErrorMessage = (errorCode, mode) => {
  if (errorCode === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }

  // Firebase intentionally returns a single invalid-credential code for many
  // email/password failures. Keep the older variants generic too so the sign-in
  // screen never reveals whether an account exists.
  if (
    mode === "login" &&
    [
      "auth/invalid-credential",
      "auth/invalid-login-credentials",
      "auth/user-not-found",
      "auth/wrong-password",
    ].includes(errorCode)
  ) {
    return GENERIC_SIGN_IN_ERROR;
  }

  if (errorCode === "auth/email-already-in-use") {
    return "This email is already registered. Please log in.";
  }

  if (errorCode === "auth/weak-password") {
    return "Password must be at least 6 characters long.";
  }

  if (errorCode === "auth/too-many-requests") {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return mode === "login"
    ? "We couldn't sign you in right now. Please try again."
    : "We couldn't create your account right now. Please try again.";
};

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("user");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        console.log("Auth: register flow started", { email, selectedRole, fullName, organizationName });
        if (!selectedRole) {
          setError("Please select a role");
          setLoading(false);
          return;
        }

        // Validate organization name for orgadmin
        if (selectedRole === "orgadmin" && !organizationName.trim()) {
          setError("Please enter your organization/company name");
          setLoading(false);
          return;
        }

        let cred;
        try {
          cred = await createUserWithEmailAndPassword(auth, email, password);
          console.log("Auth: created user", cred.user.uid);
        } catch (createErr) {
          console.error("Auth: createUser failed", createErr);
          throw createErr;
        }

        // Public registration always creates a customer account. Choosing the
        // organization option creates a reviewable application, never a
        // browser-assigned privileged role or organization record.
        const userData = {
          uid: cred.user.uid,
          name: fullName.trim(),
          email: email.trim().toLowerCase(),
          role: "user",
          phone: "",
          address: "",
          city: "",
          createdAt: serverTimestamp(),
          isApproved: false,
          isSuspended: false,
          profileComplete: false,
        };

        try {
          await setDoc(doc(db, "users", cred.user.uid), userData);

          if (selectedRole === "orgadmin") {
            await setDoc(doc(db, "organizationApplications", cred.user.uid), {
              applicantId: cred.user.uid,
              applicantName: fullName.trim(),
              applicantEmail: email.trim().toLowerCase(),
              organizationName: organizationName.trim(),
              businessPhone: "",
              businessAddress: "",
              businessCity: "",
              status: "pending",
              createdAt: serverTimestamp(),
            });
          }
        } catch (registrationWriteError) {
          console.error("Firestore registration write failed", registrationWriteError);
          throw registrationWriteError;
        }

        // After successful registration, sign the user out so they can sign in manually.
        // This avoids showing a stuck "Loading your dashboard..." state while role is resolved.
        try {
          await signOut(auth);
          console.log("Auth: signed out after registration");
        } catch (signOutErr) {
          console.error("Auth: signOut failed", signOutErr);
        }

        setSuccess(
          selectedRole === "orgadmin"
            ? "Organization application submitted. Sewak will review it before issuing organization access."
            : "Registration complete. Please sign in to continue.",
        );
        setMode("login");
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      console.error("Auth error:", err);
      setError(getAuthErrorMessage(err?.code, mode));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <h1 className="auth-title">Sewak</h1>
        <p className="auth-tagline">
          Book trusted caregivers and household help in a few clicks.
        </p>
        <ul className="auth-points">
          <li> Verified caregivers reviewed by admins</li>
          <li> Clear timings, locations, and booking history</li>
          <li> Designed for Nepali families and workers</li>
          <li> Partner organizations manage their teams</li>
        </ul>
      </div>

      <div className="auth-card">
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p>
          {mode === "login"
            ? "Sign in to manage your bookings or organization."
            : "Join Sewak as a customer or partner organization."}
        </p>

        {error && <div className="error-message" role="alert">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <form className="form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <div>
                <label>Full name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Your full name"
                />
              </div>
            </>
          )}

          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
          </div>

          <div>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder={mode === "login" ? "Your password" : "At least 6 characters"}
            />
          </div>

          {/* Move role selection (I want to register as) after password */}
          {mode === "register" && (
            <>
              <div>
                <label>I want to register as</label>
                <div className="role-selection">
                  <label className="role-option">
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={selectedRole === "user"}
                      onChange={() => setSelectedRole("user")}
                    />
                    <span>👨‍👩‍👧 Customer (Book caregivers)</span>
                  </label>
                  
                  <label className="role-option">
                    <input
                      type="radio"
                      name="role"
                      value="orgadmin"
                      checked={selectedRole === "orgadmin"}
                      onChange={() => setSelectedRole("orgadmin")}
                    />
                    <span>🏢 Organization/Company (Provide caregivers)</span>
                  </label>
                </div>
                <p className="text-muted" style={{ fontSize: 11, marginTop: 8 }}>
                  {selectedRole === "user" && "Browse and book trusted caregivers for your family"}
                  {selectedRole === "orgadmin" && "Partner with Sewak and manage your caregiver team"}
                </p>
              </div>

              {/* Organization Name - Only for orgadmin */}
              {selectedRole === "orgadmin" && (
                <div>
                  <label>Organization/Company Name</label>
                  <input
                    type="text"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    placeholder="e.g., ABC Care Services Pvt. Ltd."
                  />
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary auth-submit"
            disabled={loading}
          >
            {loading
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
              ? "Sign in"
              : "Sign up"}
          </button>
        </form>

        <div className="auth-toggle">
          {mode === "login" ? (
            <p>
              New here?{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Create an account
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode("login");
                  setError("");
                }}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
