import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

// A browser redirect is not payment proof. This route stays registered so old
// provider links land on a clear, safe screen while server-to-server Fonepay
// verification is completed.
export default function PaymentCallbackPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="centered-message">Loading payment return…</div>;
  }

  return (
    <main className="app-shell">
      <section
        className="app-card"
        style={{ maxWidth: 560, textAlign: "center" }}
        aria-live="polite"
      >
        <h1 className="section-title">Digital payment is not available yet</h1>
        <p className="text-muted">
          Sewak does not create a booking or mark a payment as complete from a
          browser return. Secure provider verification is being configured.
        </p>
        <p className="text-muted">
          {user
            ? "No payment or booking was created from this link. You can start a cash booking instead."
            : "Please sign in to start a care request after returning to Sewak."}
        </p>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => navigate(user ? "/user" : "/auth")}
        >
          {user ? "Browse caregivers" : "Sign in"}
        </button>
      </section>
    </main>
  );
}
