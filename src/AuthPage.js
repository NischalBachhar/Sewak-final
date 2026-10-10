import OrganizationFields from './components/OrganizationFields';
import React, { useEffect, useState } from "react";
import { auth, signIn, register } from "./authClient";
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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(auth.currentUser?.email || "");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState(sessionStorage.getItem("sewak.registrationRole") || "user");
  const [organization, setOrganization] = useState({});
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
        setSuccess(selectedRole === "orgadmin" ? "Application submitted for review. Organization access requires approval." : "Registration complete.");
        setPassword("");
      }
    } catch (err) {
      console.error("Auth error:", { code: err?.code || "unknown" });
      setError(err?.code === 'invalid-argument' || err?.code === 'permission-denied' ? err.message : err?.code ? getAuthErrorMessage(err.code, mode) : err.message);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = () => { setError(''); setSuccess('Contact your Sewak administrator for account recovery. Automated reset email is not configured.'); };

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

        <form className="form" onSubmit={handleSubmit} aria-describedby={mode === "register" && error ? "auth-error" : undefined}>
          {mode === "register" && (
            <>
              <div>
                <label htmlFor="auth-name">Full name</label>
                <div className="signup-input-wrap">
                <SignupIcon name="user" />
                <input
                  id="auth-name" autoComplete="name" type="text"
                  aria-describedby={error ? "auth-error" : undefined}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  placeholder="Your full name"
                />
                </div>
              </div>
            </>
          )}

          <div>
            <label htmlFor="auth-email">Email</label>
            <div className={mode === "login" ? "login-input-wrap" : "signup-input-wrap"}>
            <LoginIcon name="mail" />
            <input
              id="auth-email" autoComplete="email" type="email"
              aria-describedby={mode === "register" && error ? "auth-error" : undefined}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
            </div>
          </div>

          <div>
            <label htmlFor="auth-password">Password</label>
            <div className={mode === "login" ? "login-input-wrap login-password-wrap" : "signup-input-wrap signup-password-wrap"}>
            <LoginIcon name="lock" />
            <input
              id="auth-password" autoComplete={mode === "login" ? "current-password" : "new-password"} type={passwordVisible ? "text" : "password"}
              aria-describedby={mode === "register" ? `signup-password-help${error ? " auth-error" : ""}` : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={mode === "login" || !auth.currentUser}
              minLength={mode === "login" ? 1 : 12} maxLength={128}
              placeholder={mode === "login" ? "Your password" : "At least 12 characters"}
            />
              <button type="button" className={mode === "login" ? "login-password-toggle" : "signup-password-toggle"}
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                aria-controls="auth-password" aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible(!passwordVisible)}>
                <LoginIcon name={passwordVisible ? "eye-off" : "eye"} />
              </button>
            </div>
            {mode === "register" && <p id="signup-password-help" className="signup-field-help">At least 12 characters.</p>}
          </div>

          {/* Move role selection (I want to register as) after password */}
          {mode === "register" && (
            <>
              <div className="signup-roles">
                <p id="registration-role-label">I want to register as</p>
                <div className="role-selection" role="group" aria-labelledby="registration-role-label">
                  <label className={`role-option${selectedRole === "user" ? " signup-role--selected" : ""}`}>
                    <input
                      type="radio"
                      name="role"
                      value="user"
                      checked={selectedRole === "user"}
                      onChange={() => setSelectedRole("user")}
                    />
                    <span className="signup-role-icon"><SignupIcon name="home" /></span>
                    <span className="signup-role-copy"><strong>Customer</strong><span>Find and book trusted caregivers for your family.</span></span>
                    <span className="signup-role-check" aria-hidden="true"><SignupIcon name="check" /></span>
                  </label>
                  
                  <label className={`role-option${selectedRole === "orgadmin" ? " signup-role--selected" : ""}`}>
                    <input
                      type="radio"
                      name="role"
                      value="orgadmin"
                      checked={selectedRole === "orgadmin"}
                      onChange={() => setSelectedRole("orgadmin")}
                    />
                    <span className="signup-role-icon"><SignupIcon name="organization" /></span>
                    <span className="signup-role-copy"><strong>Organization/Company</strong><span>Manage your caregivers and provide care through Sewak.</span></span>
                    <span className="signup-role-check" aria-hidden="true"><SignupIcon name="check" /></span>
                  </label>
                </div>
                <div className="signup-role-context" aria-live="polite">
                  <span className={selectedRole === "user" ? "is-active" : ""} aria-hidden={selectedRole !== "user"}>A helping hand for the people you love.</span>
                  <span className={selectedRole === "orgadmin" ? "is-active" : ""} aria-hidden={selectedRole !== "orgadmin"}>Organization access follows application review.</span>
                </div>
              </div>

              {/* Organization Name - Only for orgadmin */}
              {selectedRole === "orgadmin" && (
                <>
                <div>
                  <label htmlFor="auth-organization">Organization/Company Name</label>
                  <div className="signup-input-wrap">
                  <SignupIcon name="organization" />
                  <input
                    type="text"
                    id="auth-organization" autoComplete="organization" value={organizationName}
                    aria-describedby={error ? "auth-error" : undefined}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    required
                    maxLength={160} placeholder="e.g., ABC Care Services Pvt. Ltd."
                  />
                  </div>
                </div>
                <OrganizationFields value={organization} onChange={setOrganization} />
                </>
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
            {mode === "register" && <span className={loading ? "signup-spinner" : "signup-submit-arrow"} aria-hidden="true">{!loading && <SignupIcon name="arrow" />}</span>}
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
