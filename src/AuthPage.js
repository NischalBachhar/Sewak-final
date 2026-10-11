import GoogleSignIn from './components/GoogleSignIn';
import SignupRegistrationForm from './components/SignupRegistrationForm';
import React, { useEffect, useRef, useState } from "react";
import { auth, signIn, register } from "./authClient";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { completeRegistration } from "./registrationService";
import LoginExperience, { LoginIcon } from "./components/LoginExperience";
import SignupExperience, { SignupIcon } from "./components/SignupExperience";
import "./AuthPage.css";
import "./SignupPage.css";

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
    return "Password must be at least 8 characters long.";
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
  const [selectedRole, setSelectedRole] = useState(auth.currentUser?.profile?.registrationRole || sessionStorage.getItem("sewak.registrationRole") || "user");
  const [organization, setOrganization] = useState({});
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => { if (userDoc?.registrationIncomplete) setMode("register"); }, [userDoc?.registrationIncomplete]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
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
          try { account = await register({ email: email.trim(), password, name: fullName.trim(), selectedRole, ...(selectedRole === 'orgadmin' ? { organizationName: organizationName.trim(), ...organization } : {}) }); }
          catch (error) {
            if (error.code !== "account-exists") throw error;
            // Resume only after the server verifies the password; never overwrite
            // another account or assign an organization role from the browser.
            account = await signIn(email.trim(), password);
          }
        }
        if (account?.emailVerified === false) { setPassword(""); return; }
        await completeRegistration(account, { fullName, selectedRole, organizationName, ...organization });
        await finishRegistration();
        setSuccess(selectedRole === "orgadmin" ? "Application submitted for review. Organization access requires approval." : "Registration complete.");
        setPassword("");
      }
    } catch (err) {
      console.error("Auth error:", { code: err?.code || "unknown" });
      setError(err?.code === 'invalid-argument' || err?.code === 'permission-denied' ? err.message : err?.code ? getAuthErrorMessage(err.code, mode) : err.message);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };



  return (
    <div className={`auth-shell ${mode === "login" ? "auth-shell--login" : "auth-shell--signup"}`}>
      {mode === "login" ? <LoginExperience /> : <SignupExperience />}

      <div className="auth-card">
        {mode === "login" && <div className="login-card-mark" aria-hidden="true"><LoginIcon name="heart" /></div>}
        {mode === "register" && <div className="signup-card-eyebrow"><span aria-hidden="true" />LET’S MAKE CARE EASIER</div>}
        <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p>
          {mode === "login"
            ? "Continue to your Sewak account."
            : "Join Sewak and make finding trusted care easier."}
        </p>
        {mode === "register" && <div className="signup-context"><SignupIcon name="heart" />Your first step to care, closer to home.</div>}

        {error && <div id="auth-error" className="error-message" role="alert">{error}</div>}
        {success && <div className="success-message" role="status">{success}</div>}

        {mode === "register" ? <SignupRegistrationForm
          values={{ fullName, email, password, selectedRole, organizationName, organization }}
          onChange={(key, value) => ({ fullName: setFullName, email: setEmail, password: setPassword, selectedRole: setSelectedRole, organizationName: setOrganizationName, organization: setOrganization })[key](value)}
          onSubmit={handleSubmit} loading={loading} passwordRequired={!auth.currentUser} error={error} clearError={() => setError('')}
        /> : <form className="form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="auth-email">Email</label>
            <div className="login-input-wrap"><LoginIcon name="mail" />
              <input id="auth-email" autoComplete="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="your@email.com" />
            </div>
          </div>
          <div>
            <label htmlFor="auth-password">Password</label>
            <div className="login-input-wrap login-password-wrap"><LoginIcon name="lock" />
              <input id="auth-password" autoComplete="current-password" type={passwordVisible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={1} maxLength={128} placeholder="Your password" />
              <button type="button" className="login-password-toggle" aria-label={passwordVisible ? 'Hide password' : 'Show password'} aria-controls="auth-password" aria-pressed={passwordVisible} onClick={() => setPasswordVisible(!passwordVisible)}><LoginIcon name={passwordVisible ? 'eye-off' : 'eye'} /></button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}<span className={loading ? 'login-spinner' : 'login-submit-arrow'} aria-hidden="true">{!loading && <LoginIcon name="arrow" />}</span></button>
        </form>}

        {mode === "login" && <Link className="link-button login-recovery" to="/account/forgot">Forgot password?</Link>}
        <GoogleSignIn role={selectedRole} />
        <div className="auth-toggle">
          {mode === "login" ? (
            <p>
              New here?{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode("register");
                  setPasswordVisible(false);
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
                  setPasswordVisible(false);
                  setError("");
                }}
              >
                Sign in
              </button>
            </p>
          )}
        </div>
        {mode === "register" && <div className="signup-footer-note"><SignupIcon name="lock" />Care begins with a little trust.</div>}
      </div>
    </div>
  );
}
