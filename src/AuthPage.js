import React, { useEffect, useState } from "react";
import { auth, signIn, register } from "./authClient";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { completeRegistration } from "./registrationService";
import LoginExperience, { LoginIcon } from "./components/LoginExperience";
import "./AuthPage.css";

const GENERIC_SIGN_IN_ERROR =
  "The email or password is incorrect. Please try again.";

const getAuthErrorMessage = (errorCode, mode) => {
  if (errorCode === "auth/invalid-email") {
    return "Please enter a valid email address.";
  }

  // Do not reveal whether an account exists through login failures.
  if (
    mode === "login" &&
    [
      "invalid-credentials",
      "auth/invalid-credential",
      "auth/invalid-login-credentials",
      "auth/user-not-found",
      "auth/wrong-password",
    ].includes(errorCode)
  ) {
    return GENERIC_SIGN_IN_ERROR;
  }

  if (errorCode === "account-exists") {
    return "This email is already registered. Please log in.";
  }

  if (errorCode === "auth/weak-password") {
    return "Password must be at least 12 characters long.";
  }

  if (errorCode === "rate-limited") {
    return "Too many attempts. Please wait a moment and try again.";
  }

  return mode === "login"
    ? "We couldn't sign you in right now. Please try again."
    : "We couldn't create your account right now. Please try again.";
};

export default function AuthPage() {
  const [params] = useSearchParams();
  const { beginRegistration, finishRegistration, registrationPending, userDoc } = useAuth();
  const [mode, setMode] = useState(params.get("mode") === "register" || registrationPending || userDoc?.registrationIncomplete ? "register" : "login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(auth.currentUser?.email || "");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState(sessionStorage.getItem("sewak.registrationRole") || "user");
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => { if (userDoc?.registrationIncomplete) setMode("register"); }, [userDoc?.registrationIncomplete]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "login") {
        await signIn(email, password);
        if (registrationPending) {
          setMode("register");
          setSuccess("Signed in. Complete your profile/application setup to continue.");
        }
      } else {
        if (fullName.trim().length < 2) throw new Error("Enter your full name.");
        if (selectedRole === "orgadmin" && organizationName.trim().length < 2) throw new Error("Enter your organization name.");
        beginRegistration(selectedRole);
        let account = auth.currentUser;
        if (!account || account.email?.toLowerCase() !== email.trim().toLowerCase()) {
          try { account = await register({ email: email.trim(), password, name: fullName.trim() }); }
          catch (error) {
            if (error.code !== "account-exists") throw error;
            // Resume only after the server verifies the password; never overwrite
            // another account or assign an organization role from the browser.
            account = await signIn(email.trim(), password);
          }
        }
        await completeRegistration(account, { fullName, selectedRole, organizationName });
        await finishRegistration();
        setSuccess(selectedRole === "orgadmin" ? "Application submitted for review. Organization access requires approval." : "Registration complete.");
        setPassword("");
      }
    } catch (err) {
      console.error("Auth error:", { code: err?.code || "unknown" });
      setError(err?.code ? getAuthErrorMessage(err.code, mode) : err.message);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = () => { setError(''); setSuccess('Contact your Sewak administrator for account recovery. Automated reset email is not configured.'); };

  return (
    <div className={`auth-shell${mode === "login" ? " auth-shell--login" : ""}`}>
      {mode === "login" ? <LoginExperience /> : (
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
      )}

      <div className="auth-card">
        {mode === "login" && <div className="login-card-mark" aria-hidden="true"><LoginIcon name="heart" /></div>}
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p>
          {mode === "login"
            ? "Continue to your Sewak account."
            : "Join Sewak as a customer or partner organization."}
        </p>

        {error && <div className="error-message" role="alert">{error}</div>}
        {success && <div className="success-message" role={mode === "login" ? "status" : undefined}>{success}</div>}

        <form className="form" onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <div>
                <label htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name" autoComplete="name" type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Your full name"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email">Email</label>
            <div className={mode === "login" ? "login-input-wrap" : undefined}>
            {mode === "login" && <LoginIcon name="mail" />}
            <input
              id="auth-email" autoComplete="email" type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password">Password</label>
            <div className={mode === "login" ? "login-input-wrap login-password-wrap" : undefined}>
            {mode === "login" && <LoginIcon name="lock" />}
            <input
              id="auth-password" autoComplete={mode === "login" ? "current-password" : "new-password"} type={mode === "login" && passwordVisible ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={mode === "login" || !auth.currentUser}
              minLength={mode === "login" ? 1 : 12} maxLength={128}
              placeholder={mode === "login" ? "Your password" : "At least 12 characters"}
            />
            {mode === "login" && (
              <button type="button" className="login-password-toggle"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                aria-controls="auth-password" aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible(!passwordVisible)}>
                <LoginIcon name={passwordVisible ? "eye-off" : "eye"} />
              </button>
            )}
            </div>
          </div>

          {/* Move role selection (I want to register as) after password */}
          {mode === "register" && (
            <>
              <div>
                <p id="registration-role-label">I want to register as</p>
                <div className="role-selection" role="group" aria-labelledby="registration-role-label">
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
                  <label htmlFor="auth-organization">Organization/Company Name</label>
                  <input
                    type="text"
                    id="auth-organization" autoComplete="organization" value={organizationName}
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
            {mode === "login" && <span className={loading ? "login-spinner" : "login-submit-arrow"} aria-hidden="true">{!loading && <LoginIcon name="arrow" />}</span>}
          </button>
        </form>

        {mode === "login" && <button type="button" className="link-button login-recovery" disabled={loading} onClick={forgotPassword}>Forgot password?</button>}
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
