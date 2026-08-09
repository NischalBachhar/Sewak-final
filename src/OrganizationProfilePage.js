import React, { useEffect, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

export default function OrganizationProfilePage() {
  const { user, userDoc, refreshUserDoc } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [organizationName, setOrganizationName] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessCity, setBusinessCity] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shouldNavigate, setShouldNavigate] = useState(false);

  // Watch for profile completion and navigate
  useEffect(() => {
    if (shouldNavigate && userDoc?.profileComplete) {
      console.log("Profile complete, navigating to dashboard");
      navigate("/organization/dashboard");
    }
  }, [userDoc?.profileComplete, shouldNavigate, navigate]);

  useEffect(() => {
    if (userDoc) {
      setOrganizationName(userDoc.organizationName || "");
      setBusinessPhone(userDoc.businessPhone || "");
      setBusinessAddress(userDoc.businessAddress || "");
      setBusinessCity(userDoc.businessCity || "");
    }
    setLoading(false);
  }, [userDoc]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!organizationName || !businessPhone || !businessAddress || !businessCity) {
      setError("All fields are required");
      return;
    }

    // Validate phone
    const phoneDigits = businessPhone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    try {
      setSubmitting(true);

      // Update Firestore (use setDoc with merge to create if doesn't exist)
      await setDoc(doc(db, "organizations", user.uid), {
        organizationName,
        businessPhone,
        businessAddress,
        businessCity,
        profileComplete: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      
      // Also update users collection for orgadmin
      await setDoc(doc(db, "users", user.uid), {
        profileComplete: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setSuccess("Profile saved successfully!");

      // Refresh user context to update profileComplete status
      console.log("Refreshing user doc...");
      await refreshUserDoc();
      console.log("User doc refreshed, setting flag to navigate");
      
      // Set flag to trigger navigation when userDoc updates
      setShouldNavigate(true);
    } catch (err) {
      console.error("Error saving profile:", err);
      setError(err.message || "Could not save profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <p style={{ color: "var(--theme-text-muted)", textAlign: "center", padding: 20 }}>
        Loading profile...
      </p>
    );


  return (
    <div className="app-shell">
      <div className="app-card" style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: "var(--theme-text)", fontSize: 24, marginBottom: 8 }}>
            Organization Profile
          </h1>
          <p style={{ fontSize: 13, color: "var(--theme-text-muted)", margin: 0 }}>
            {!userDoc?.profileComplete
              ? "Complete your organization profile to start managing caregivers"
              : "Update your organization information"}
          </p>
        </div>

        {/* Mandatory Notice */}
        {!userDoc?.profileComplete && (
          <div
            style={{
              background: "var(--theme-help-soft)",
              color: "var(--theme-help)",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
              border: "1px solid var(--theme-help-light)",
            }}
          >
            <strong>ℹ️ Required:</strong> Your organization information will be
            used for verification and caregiver management.
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
        {success && (
          <div
            style={{
              background: "var(--theme-positive-soft)",
              color: "var(--theme-positive)",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
              border: "1px solid var(--theme-positive-soft)",
            }}
          >
            ✓ {success}
          </div>
        )}

        {/* Organization Information Form */}
        <form onSubmit={handleSave} className="form">
          <label>Organization Name *</label>
          <input
            type="text"
            value={organizationName}
            onChange={(e) => setOrganizationName(e.target.value)}
            required
            placeholder="Your organization/company name"
          />

          <label>Business Phone *</label>
          <input
            type="tel"
            value={businessPhone}
            onChange={(e) => setBusinessPhone(e.target.value)}
            required
            placeholder="98XXXXXXXX"
            maxLength={10}
          />

          <label>Business Address *</label>
          <input
            type="text"
            value={businessAddress}
            onChange={(e) => setBusinessAddress(e.target.value)}
            required
            placeholder="Organization address"
          />

          <label>City *</label>
          <select
            value={businessCity}
            onChange={(e) => setBusinessCity(e.target.value)}
            required
          >
            <option value="">Select city</option>
            <option value="Kathmandu">Kathmandu</option>
            <option value="Lalitpur">Lalitpur</option>
            <option value="Bhaktapur">Bhaktapur</option>
            <option value="Pokhara">Pokhara</option>
            <option value="Biratnagar">Biratnagar</option>
            <option value="Birgunj">Birgunj</option>
            <option value="Butwal">Butwal</option>
            <option value="Dharan">Dharan</option>
            <option value="Other">Other</option>
          </select>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ marginTop: 16 }}
          >
            {submitting ? "Saving..." : "Save Profile"}
          </button>
        </form>

        {/* Profile Completion Indicator */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "var(--theme-surface)",
            border: "1px solid var(--theme-text)",
            borderRadius: 8,
          }}
        >
          <h4 style={{ color: "var(--theme-text)", marginTop: 0, marginBottom: 12 }}>
            Profile Completion
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: organizationName ? "var(--theme-positive)" : "var(--theme-text-muted)" }}>
                {organizationName ? "✓" : "○"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: organizationName ? "var(--theme-positive)" : "var(--theme-text-muted)",
                }}
              >
                Organization name
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: businessPhone ? "var(--theme-positive)" : "var(--theme-text-muted)" }}>
                {businessPhone ? "✓" : "○"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: businessPhone ? "var(--theme-positive)" : "var(--theme-text-muted)",
                }}
              >
                Business phone
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: businessAddress ? "var(--theme-positive)" : "var(--theme-text-muted)" }}>
                {businessAddress ? "✓" : "○"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: businessAddress ? "var(--theme-positive)" : "var(--theme-text-muted)",
                }}
              >
                Business address
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: businessCity ? "var(--theme-positive)" : "var(--theme-text-muted)" }}>
                {businessCity ? "✓" : "○"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: businessCity ? "var(--theme-positive)" : "var(--theme-text-muted)",
                }}
              >
                City
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: 16 }}>
            {(() => {
              const completed = [
                organizationName,
                businessPhone,
                businessAddress,
                businessCity,
              ].filter(Boolean).length;
              const total = 4;
              const percentage = Math.round((completed / total) * 100);

              return (
                <>
                  <div
                    style={{
                      width: "100%",
                      height: 8,
                      background: "var(--theme-border)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: "100%",
                        background: percentage === 100 ? "var(--theme-positive)" : "var(--theme-help)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--theme-text-muted)",
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    {percentage}% Complete {percentage === 100 && "🎉"}
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
