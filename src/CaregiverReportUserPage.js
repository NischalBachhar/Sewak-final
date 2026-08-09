import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { useAuth } from "./AuthContext";

const REPORT_REASONS = [
  "Non-payment",
  "Abusive behavior",
  "Safety concerns",
  "Cancellation without notice",
  "Inappropriate requests",
  "Other",
];

export default function CaregiverReportUserPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, userDoc } = useAuth();
  const bookingId = searchParams.get("bookingId") || "";
  const [booking, setBooking] = useState(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let active = true;

    const loadAssignedBooking = async () => {
      setLoadingBooking(true);
      setError("");
      if (!user?.uid || !bookingId) {
        if (active) setError("Open this form from an assigned booking.");
        if (active) setLoadingBooking(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "bookings", bookingId));
        if (!snapshot.exists()) {
          throw new Error("This booking is no longer available.");
        }

        const data = { id: snapshot.id, ...snapshot.data() };
        if (data.caregiverId !== user.uid) {
          throw new Error("You can report a customer only from one of your assigned bookings.");
        }

        if (active) setBooking(data);
      } catch (loadError) {
        if (active) setError(loadError.message || "We could not load this booking.");
      } finally {
        if (active) setLoadingBooking(false);
      }
    };

    loadAssignedBooking();
    return () => {
      active = false;
    };
  }, [bookingId, user?.uid]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!booking) {
      setError("The assigned booking could not be verified.");
      return;
    }
    if (!reason) {
      setError("Choose a reason for this report.");
      return;
    }
    if (!description.trim()) {
      setError("Describe what happened so the review team has enough context.");
      return;
    }

    try {
      setSubmitting(true);
      await addDoc(collection(db, "blacklistReports"), {
        bookingId: booking.id,
        userId: booking.userId,
        userType: "user",
        userName: booking.userName || "Customer",
        reportedBy: user.uid,
        reportedByName: userDoc?.name || user.displayName || "Caregiver",
        reportedByOrgId: booking.organizationId || "",
        reason,
        description: description.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message || "We could not submit this report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="app-shell">
      <section className="app-card" style={{ maxWidth: 640 }} aria-labelledby="report-user-heading">
        <p className="booking-form-eyebrow">Safety and conduct</p>
        <h1 id="report-user-heading" style={{ color: "var(--theme-text)", fontSize: 26, marginTop: 0 }}>
          Report a customer
        </h1>
        <p className="text-muted">
          This report is tied to the assigned booking below. It is sent for review; submitting it does not automatically restrict the customer.
        </p>

        {loadingBooking ? <p className="text-muted">Checking the assigned booking…</p> : null}
        {error ? <p className="error-message" role="alert">{error}</p> : null}

        {booking ? (
          <>
            <div className="card" style={{ margin: "18px 0", background: "var(--theme-surface)" }}>
              <p style={{ margin: "0 0 6px" }}><strong>Customer:</strong> {booking.userName || "Customer"}</p>
              <p style={{ margin: "0 0 6px" }}><strong>Care date:</strong> {booking.date || "To be confirmed"} {booking.time ? `at ${booking.time}` : ""}</p>
              <p style={{ margin: 0 }}><strong>Booking reference:</strong> {booking.id.slice(0, 12)}</p>
            </div>

            {submitted ? (
              <div className="success-message" role="status">
                Report submitted for review. Thank you for documenting the issue clearly.
                <div style={{ marginTop: 14 }}>
                  <button type="button" className="btn btn-primary" onClick={() => navigate("/caregiver/jobs")}>Return to jobs</button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="form">
                <label htmlFor="report-reason">Reason *</label>
                <select id="report-reason" value={reason} onChange={(event) => setReason(event.target.value)} required>
                  <option value="">Select a reason</option>
                  {REPORT_REASONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>

                <label htmlFor="report-description">What happened? *</label>
                <textarea
                  id="report-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  maxLength={2000}
                  placeholder="Include only the facts needed to review the concern."
                  rows={6}
                  style={{ resize: "vertical" }}
                />

                <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? "Submitting…" : "Submit report for review"}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => navigate("/caregiver/jobs")}>Cancel</button>
                </div>
              </form>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}
