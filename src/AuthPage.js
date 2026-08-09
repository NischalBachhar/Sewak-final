import React, { useState } from "react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import "./AuthPage.css";

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

        let userData = {
          uid: cred.user.uid,
          name: fullName,
          email,
          role: selectedRole,
          createdAt: new Date().toISOString(),
          isApproved: false,
          isSuspended: false,
          profileComplete: false,
        };

        // USER/CUSTOMER
        if (selectedRole === "user") {
          userData = {
            ...userData,
            phone: "",
            address: "",
            city: "",
            profileComplete: false, // Must complete before booking
          };
        }

        // ORGANIZATION ADMIN (Partner Vendor)
        if (selectedRole === "orgadmin") {
          userData = {
            ...userData,
            organizationName: organizationName.trim(),
            organizationId: cred.user.uid,
            businessLicense: "",
            businessPhone: "",
            businessAddress: "",
            businessCity: "",
            totalCaregivers: 0,
            totalEarnings: 0,
            totalBookings: 0,
            commissionRate: 15, // Default, can be changed by superadmin
            isApproved: false, // Superadmin must approve
            verified: false,
            profileComplete: false,
          };

          // Create organization document
          try {
            await setDoc(doc(db, "organizations", cred.user.uid), {
            organizationId: cred.user.uid,
            organizationName: organizationName.trim(),
            adminUid: cred.user.uid,
            adminName: fullName,
            adminEmail: email,
            businessPhone: "",
            businessAddress: "",
            businessCity: "",
            caregivers: [], // Array of caregiver UIDs under this org
            totalCaregivers: 0,
            totalEarnings: 0,
            totalBookings: 0,
            commissionRate: 15,
            isApproved: false,
            verified: false,
            profileComplete: false,
            role: "orgadmin",
            createdAt: new Date().toISOString(),
            });
            console.log("Firestore: organization document written:", cred.user.uid);
          } catch (orgErr) {
            console.error("Firestore: organization write failed", orgErr);
            throw orgErr;
          }
        }

        // NOTE: Individual caregivers CANNOT sign up directly
        // They must be added by organization admins

        try {
          await setDoc(doc(db, "users", cred.user.uid), userData);
          console.log("Firestore: user document written:", cred.user.uid, userData);
        } catch (userErr) {
          console.error("Firestore: user write failed", userErr);
          throw userErr;
        }

        // After successful registration, sign the user out so they can sign in manually.
        // This avoids showing a stuck "Loading your dashboard..." state while role is resolved.
        try {
          await signOut(auth);
          console.log("Auth: signed out after registration");
        } catch (signOutErr) {
          console.error("Auth: signOut failed", signOutErr);
        }

        setSuccess("Registration complete. Please sign in to continue.");
        setMode("login");
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      console.error("Auth error:", err);

      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please log in.");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters long.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/user-not-found") {
        setError("No account found. Please sign up first.");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password.");
      } else {
        setError(err.message || "Something went wrong.");
      }
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

        {error && <div className="error-message">{error}</div>}
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
            className="btn btn-primary"
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
