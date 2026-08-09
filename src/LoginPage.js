import React, { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "./firebaseConfig";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Redirect handled by AuthContext and App.js
    } catch (err) {
      console.error("Login error:", err);
      
      // Handle specific Firebase errors
      if (err.code === "auth/user-not-found") {
        setError("No account found with this email. Please sign up first.");
      } else if (err.code === "auth/wrong-password") {
        setError("Incorrect password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please try again later.");
      } else {
        setError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h2 style={{ color: "var(--theme-button-text)", marginBottom: 8 }}>Welcome back</h2>
        <p style={{ color: "var(--theme-text-muted)", fontSize: 14, marginBottom: 20 }}>
          Sign in to continue to Sewak
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

        <form onSubmit={handleLogin} className="form">
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
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "var(--theme-text-muted)" }}>
          Don't have an account?{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => (window.location.href = "/auth")}
          >
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
}
