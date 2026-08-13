import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "./firebaseConfig";
import { formatNpr } from "./config/brand";
import { bookingScheduleLabel, getBookingStatus, normalizeBooking } from "./bookingModel";
import { submitVerifiedReview } from "./careSessionService";
import {
  ActiveCareCard,
  CareJourneyTimeline,
  EmptyState,
  ErrorState,
  SkeletonCard,
  StatusBadge,
} from "./components/CareExperience";
import { useAuth } from "./AuthContext";
import "./BookingDetailPage.css";

const readTimestamp = (value) => value?.toDate?.() || value || null;

function SessionReview({ booking, existingReview, onSubmitted }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (booking.status !== "completed") return null;
  if (existingReview) {
    return (
      <section className="booking-detail-review" aria-label="Your verified review">
        <p className="booking-detail-eyebrow">Verified review</p>
        <h2>Thank you for your feedback</h2>
        <p>★ {existingReview.rating}/5 {existingReview.comment ? `· ${existingReview.comment}` : ""}</p>
      </section>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await submitVerifiedReview({ booking, userId: user?.uid, rating, comment });
      onSubmitted?.();
    } catch (submitError) {
      setError(submitError.message || "We could not save your review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="booking-detail-review" aria-labelledby="review-heading">
      <p className="booking-detail-eyebrow">Care completed</p>
      <h2 id="review-heading">How was your care experience?</h2>
      <p>Only customers with a completed booking can leave a verified review.</p>
      {error ? <p className="error-message">{error}</p> : null}
      <form onSubmit={handleSubmit} className="booking-detail-review__form">
        <label htmlFor="verified-review-rating">Your rating</label>
        <select id="verified-review-rating" value={rating} onChange={(event) => setRating(Number(event.target.value))}>
          {[5, 4, 3, 2, 1].map((option) => <option key={option} value={option}>{option} star{option === 1 ? "" : "s"}</option>)}
        </select>
        <label htmlFor="verified-review-comment">Share a short note (optional)</label>
        <textarea
          id="verified-review-comment"
          value={comment}
          maxLength={600}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Tell other families what was helpful."
        />
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving review…" : "Submit verified review"}
        </button>
      </form>
    </section>
  );
}

export default function BookingDetailPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [session, setSession] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookingId) return undefined;
    const unsubscribers = [];
    const stopBooking = onSnapshot(
      doc(db, "bookings", bookingId),
      (snapshot) => {
        if (!snapshot.exists()) {
          setError("This booking is not available.");
          setLoading(false);
          return;
        }
        setBooking(normalizeBooking({ id: snapshot.id, ...snapshot.data() }));
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message || "We could not load this booking.");
        setLoading(false);
      },
    );
    unsubscribers.push(stopBooking);

    const sessionRef = doc(db, "careSessions", bookingId);
    unsubscribers.push(onSnapshot(sessionRef, (snapshot) => setSession(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)));
    unsubscribers.push(onSnapshot(
      query(collection(sessionRef, "tasks"), orderBy("createdAt", "asc")),
      (snapshot) => setTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () => setTasks([]),
    ));
    unsubscribers.push(onSnapshot(
      query(collection(sessionRef, "updates"), orderBy("createdAt", "desc")),
      (snapshot) => setUpdates(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
      () => setUpdates([]),
    ));
    unsubscribers.push(onSnapshot(doc(db, "reviews", bookingId), (snapshot) => setReview(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null)));

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [bookingId]);

  if (loading) {
    return <main className="booking-detail-page" aria-busy="true"><SkeletonCard /><SkeletonCard /></main>;
  }

  if (error || !booking) {
    return (
      <main className="booking-detail-page">
        <ErrorState title="Booking unavailable" description={error || "This booking could not be found."} actionLabel="My bookings" onAction={() => navigate("/user/mybookings")} />
      </main>
    );
  }

  const status = getBookingStatus(booking.status);
  const hasLiveSession = session && ["in_progress", "checked_in", "completed"].includes(session.status);

  return (
    <main className="booking-detail-page">
      <button type="button" className="booking-detail-back" onClick={() => navigate("/user/mybookings")}>Back to my bookings</button>
      <header className="booking-detail-hero">
        <div>
          <p className="booking-detail-eyebrow">Booking #{booking.id.slice(0, 8)}</p>
          <h1>{booking.caregiverName}</h1>
          <p>{booking.serviceLabel} · {bookingScheduleLabel(booking)}</p>
        </div>
        <StatusBadge status={booking.status} />
      </header>

      <section className="booking-detail-next" aria-labelledby="booking-next-heading">
        <p className="booking-detail-eyebrow">What happens next</p>
        <h2 id="booking-next-heading">{status.label}</h2>
        <p>{status.nextStep}</p>
      </section>

      <div className="booking-detail-grid">
        <div className="booking-detail-main">
          {hasLiveSession ? (
            <ActiveCareCard
              session={session}
              status={session.status}
              caregiverName={booking.caregiverName}
              caregiverImage={booking.caregiverProfileImage}
              service={booking.serviceLabel}
              checkedInAt={readTimestamp(session.actualCheckIn)}
              checkedOutAt={readTimestamp(session.actualCheckOut)}
              tasks={tasks}
              updates={updates}
              showTaskEmptyState
              carePlanHeading="Today's care"
              updatesHeading="Latest updates"
            />
          ) : booking.status === "accepted" ? (
            <section className="booking-detail-session-pending">
              <h2>Care session has not started yet</h2>
              <p>Your caregiver can check in when care begins. This page will show real updates once they do.</p>
            </section>
          ) : null}

          <CareJourneyTimeline
            status={booking.status}
            heading="Your care journey"
            description="See where this request is now and what will happen next."
            nextAction={{ title: status.label, description: status.nextStep }}
            events={[
              { stage: "submitted", timestamp: booking.createdAt },
              { stage: "in_progress", timestamp: session?.actualCheckIn },
              { stage: "completed", timestamp: session?.actualCheckOut },
            ]}
          />
          <SessionReview booking={booking} existingReview={review} onSubmitted={() => {}} />
        </div>

        <aside className="booking-detail-summary">
          <h2>Booking details</h2>
          <dl>
            <div><dt>Caregiver</dt><dd>{booking.caregiverName}</dd></div>
            <div><dt>Service</dt><dd>{booking.serviceLabel}</dd></div>
            <div><dt>Schedule</dt><dd>{bookingScheduleLabel(booking)}</dd></div>
            <div><dt>Location</dt><dd>{booking.address || booking.city || "To be confirmed"}</dd></div>
            <div><dt>Payment</dt><dd>{booking.paymentStatus === "awaiting_verification" ? "Verification pending" : booking.paymentMethod === "cash" ? "Cash payment pending" : booking.paymentStatus || "Pending"}</dd></div>
            <div><dt>Total</dt><dd>{formatNpr(booking.totalAmount, "To be confirmed")}</dd></div>
          </dl>
          {booking.notes || booking.careNeeds ? <p className="booking-detail-instructions"><strong>Care instructions</strong>{booking.careNeeds || booking.notes}</p> : null}
        </aside>
      </div>

      {!hasLiveSession && booking.status === "in_progress" ? (
        <EmptyState title="Care is marked in progress" description="Live care details will appear when the caregiver records a real check-in." compact />
      ) : null}
    </main>
  );
}
