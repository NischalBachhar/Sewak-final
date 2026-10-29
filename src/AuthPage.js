import SignupRegistrationForm from './components/SignupRegistrationForm';
import React, { useEffect, useRef, useState } from "react";
import { auth, signIn, register, authOptions, continueWithGoogle, requestPasswordReset } from "./authClient";
import { useSearchParams } from "react-router-dom";
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
  const [fullName, setFullName] = useState(auth.currentUser?.displayName || "");
  const [email, setEmail] = useState(auth.currentUser?.email || "");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState(() => ["user", "orgadmin", "caregiver"].includes(params.get("role")) ? params.get("role") : sessionStorage.getItem("sewak.registrationRole") || "user");
  const [organization, setOrganization] = useState({});
  const [organizationName, setOrganizationName] = useState("");
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [options, setOptions] = useState({});
  const [recovering, setRecovering] = useState(false);
  const googleIssue = params.get('google');
  useEffect(() => {
    let active = true;
    authOptions().then(value => { if (active) setOptions(value); }).catch(() => {});
    const issue = googleIssue;
    if (issue) setError(issue === 'link-required' ? 'Sign in with your Sewak password, then connect Google in notification preferences.' : issue === 'gmail-required' ? 'Choose a verified Gmail account to continue.' : issue === 'cancelled' ? 'Google sign-in was cancelled. You can try again.' : 'Google sign-in could not be completed. Please try again.');
    return () => { active = false; };
  }, [googleIssue]);
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
        await completeRegistration(account, { fullName, selectedRole, organizationName, ...organization });
        await finishRegistration();
        setSuccess(selectedRole === "orgadmin" ? "Application submitted for review. Organization access requires approval." : selectedRole === "caregiver" ? "Caregiver account created. Complete your profile. Approval is required before clients can book you." : "Registration complete.");
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

  async function forgotPassword(event) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setLoading(true); setError(''); setSuccess('');
    try { const result = await requestPasswordReset(email.trim()); setSuccess(result.message); }
    catch (err) { setError(err.message); }
    finally { submitting.current = false; setLoading(false); }
  }
  async function googleSignIn() {
    if (submitting.current) return;
    submitting.current = true; setLoading(true); setError('');
    try { if (mode === 'register') sessionStorage.setItem('sewak.registrationRole', selectedRole); await continueWithGoogle(); }
    catch (err) { setError(err.message); submitting.current = false; setLoading(false); }
  }

  return (
    <div className={`auth-shell marketplace-auth ${mode === "login" ? "auth-shell--login" : "auth-shell--signup"}`}>
      {mode === "login" ? <LoginExperience /> : <SignupExperience />}

      <main id="main-content" className="auth-card">
        {mode === "login" && <div className="login-card-mark" aria-hidden="true"><LoginIcon name="heart" /></div>}
        {mode === "register" && <div className="signup-card-eyebrow"><span aria-hidden="true" />LET’S MAKE CARE EASIER</div>}
        <h1>{recovering ? "Reset your password" : mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p>
          {recovering ? "Enter your account email. We’ll send a secure link to your inbox." : mode === "login"
            ? "Continue to your Sewak workspace."
            : "Join Sewak and make finding trusted care easier."}
        </p>
        {mode === "register" && <div className="signup-context"><SignupIcon name="heart" />Your first step to care, closer to home.</div>}

        {error && <div id="auth-error" className="error-message" role="alert">{error}</div>}
        {success && <div className="success-message" role="status">{success}</div>}

        {!recovering && !auth.currentUser && options.google && <><button type="button" className="auth-google-button" disabled={loading} onClick={googleSignIn}><svg aria-hidden="true" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.02 46.98 31.89 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.6.27-3.13.76-4.59l-7.98-6.19A23.87 23.87 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>Continue with Google</button><p className="auth-provider-note">Use your Gmail account. Sewak never sees your Google password.</p><div className="auth-divider">or continue with email</div></>}
        {recovering ? <form className="form" onSubmit={forgotPassword}>
          <label htmlFor="recovery-email">Account email</label><input id="recovery-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} placeholder="you@gmail.com" />
          <button className="btn btn-primary auth-submit" disabled={loading} type="submit">{loading ? 'Sending…' : 'Send reset link'}</button>
          <p>For Google-only accounts, use Continue with Google. Recover your Google password through Google.</p>
          <button className="link-button" type="button" disabled={loading} onClick={() => { setRecovering(false); setError(''); setSuccess(''); }}>Back to sign in</button>
        </form> : mode === "register" ? <SignupRegistrationForm
          initialRoleSelected={["user", "orgadmin", "caregiver"].includes(params.get("role")) || registrationPending || Boolean(userDoc?.registrationIncomplete)}
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

        {!recovering && mode === "login" && <button type="button" className="link-button login-recovery" disabled={loading} onClick={() => { setRecovering(true); setError(''); setSuccess(''); }}>Forgot password?</button>}
        {!recovering && <div className="auth-toggle">
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
        </div>}
        {mode === "register" && <div className="signup-footer-note"><SignupIcon name="lock" />Care begins with a little trust.</div>}
        <a className="auth-home-link" href="/">Back to Sewak home</a>
      </main>
    </div>
  );
}
