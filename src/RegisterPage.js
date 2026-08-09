// src/RegisterPage.js (updated)
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebaseConfig";
import { saveOrganizationRecord } from "./saveOrganizationRecord"; // NEW import

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });

      let userData = {
        uid: cred.user.uid,
        name,
        email,
        role,
        createdAt: new Date().toISOString(),
        isApproved: role === "admin" || role === "superadmin" ? true : false,
        isSuspended: false,
      };

      // If self‑registered organization admin
      if (role === "orgadmin") {
        userData = {
          ...userData,
          profileComplete: false,
          isApproved: false,
          organizationName: "",
          businessPhone: "",
          businessAddress: "",
          businessCity: "",
        };

        // NEW: create basic organizations doc so admin dashboard can see this org
        await saveOrganizationRecord({
          orgUid: cred.user.uid,
          organizationName: "",
          adminName: name,
          adminEmail: email,
          businessPhone: "",
          businessAddress: "",
          businessCity: "",
          isApproved: false,
          verified: false,
        });
      }

      // Create user document
      await setDoc(doc(db, "users", cred.user.uid), userData);

      await signOut(auth);
      window.location.href = "/auth";
      // Redirect handled by AuthContext (orgadmin -> /organization)
    } catch (err) {
      console.error("Registration error:", err);

      if (err.code === "auth/email-already-in-use") {
        setError("This email is already registered. Please log in instead.");
      } else if (err.code === "auth/weak-password") {
        setError("Password must be at least 6 characters long.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError(err.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 style={{ color: "var(--theme-button-text)", marginBottom: 8 }}>
          Create your account
        </h2>
        <p style={{ color: "var(--theme-text-muted)", fontSize: 14, marginBottom: 20 }}>
          Join Sewak as a user or organization
        </p>

        {error && (
          <div
            style={{
              background: "var(--theme-danger-soft)",
              color: "var(--theme-danger)",
              padding: "10px 12px",
              borderRadius: "8px",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="form">
          <label>Full name</label>
          <input
            placeholder="Your full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label>Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          <label>I am registering as a...</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            <option value="user">👨‍👩‍👧 Family / User (Hiring)</option>
            <option value="orgadmin">🏢 Organization (Service Provider)</option>
          </select>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div
          style={{
            marginTop: 16,
            textAlign: "center",
            fontSize: 12,
            color: "var(--theme-text-muted)",
          }}
        >
          Already have an account?{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => (window.location.href = "/auth")}
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
