import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "./firebaseConfig";
import { useAuth } from "./AuthContext";
import { bookingScheduleLabel, getBookingStatus, normalizeBooking } from "./bookingModel";
import { formatNpr } from "./config/brand";
import { EmptyState, ErrorState, SkeletonCard, StatusBadge } from "./components/CareExperience";

const bookingDateTime = (booking) => {
  const dateMatch = String(booking?.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return booking?.createdAt?.toDate?.()?.getTime?.() || 0;

  const [, year, month, day] = dateMatch;
  const timeMatch = String(booking?.time || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  let hour = 0;
  let minute = 0;
  if (timeMatch) {
    hour = Number(timeMatch[1]);
    minute = Number(timeMatch[2] || 0);
    const meridiem = timeMatch[3]?.toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  }

  return new Date(Number(year), Number(month) - 1, Number(day), hour, minute).getTime();
};

export default function CustomerHomePage() {
  const { user, userDoc } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return undefined;
    }

    const bookingsQuery = query(collection(db, "bookings"), where("userId", "==", user.uid));
    return onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const nextBookings = snapshot.docs
          .map((item) => normalizeBooking({ id: item.id, ...item.data() }))
          .sort((first, second) => bookingDateTime(first) - bookingDateTime(second));
        setBookings(nextBookings);
        setError("");
        setLoading(false);
      },
      (snapshotError) => {
        setError(snapshotError.message || "We could not load your care overview.");
        setLoading(false);
      },
    );
  }, [user?.uid]);

  const activeBookings = useMemo(
    () => bookings.filter((booking) => ["pending", "accepted", "in_progress"].includes(booking.status)),
    [bookings],
  );
  const nextBooking = activeBookings[0] || null;
  const completedBookings = bookings.filter((booking) => booking.status === "completed");

  if (loading) {
    return (
      <main className="customer-home" aria-busy="true" aria-label="Loading your care overview">
        <SkeletonCard />
        <SkeletonCard />
      </main>
    );
  }

  if (error) {
    return (
      <main className="customer-home" style={{ display: "grid", gap: 16 }}>
        <ErrorState
          title="We couldn't load your care overview"
          description={error}
          actionLabel="Try again"
          onAction={() => window.location.reload()}
        />
      </main>
    );
  }

  return (
    <main className="customer-home" style={{ display: "grid", gap: 16 }}>
      <header>
        <p style={{ color: "var(--theme-help)", fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", margin: "0 0 5px" }}>
          FAMILY CARE
        </p>
        <h1 className="section-title section-title--compact" style={{ marginBottom: 6 }}>
          Welcome back, {userDoc?.name || "there"}
        </h1>
        <p style={{ color: "var(--theme-text-muted)", fontSize: 14, lineHeight: 1.5, margin: 0 }}>
          Keep track of care requests, visits, and updates in one place.
        </p>
      </header>

      {nextBooking ? (
        <section className="card" aria-labelledby="customer-next-care">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ color: "var(--theme-text-muted)", fontSize: 12, fontWeight: 800, letterSpacing: "0.05em", margin: "0 0 6px" }}>
                NEXT CARE
              </p>
              <h2 id="customer-next-care" style={{ color: "var(--theme-text)", fontSize: 20, margin: "0 0 4px" }}>
                {nextBooking.caregiverName}
              </h2>
              <p style={{ color: "var(--theme-text-muted)", fontSize: 13, margin: 0 }}>
                {nextBooking.serviceLabel} · {bookingScheduleLabel(nextBooking)}
              </p>
            </div>
            <StatusBadge status={nextBooking.status} />
          </div>
          <p style={{ color: "var(--theme-text)", fontSize: 13, lineHeight: 1.5, margin: "14px 0" }}>
            <strong>What happens next:</strong> {getBookingStatus(nextBooking.status).nextStep}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/user/bookings/${nextBooking.id}`)}>
            View care details
          </button>
        </section>
      ) : (
        <EmptyState
          title="No upcoming care yet"
          description="Browse caregivers when your family needs support. Your confirmed visits and real care updates will appear here."
          actionLabel="Find a caregiver"
          onAction={() => navigate("/user")}
        />
      )}

      <section className="card" aria-labelledby="customer-home-summary">
        <h2 id="customer-home-summary" style={{ color: "var(--theme-text)", fontSize: 18, margin: "0 0 14px" }}>
          Your care summary
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          <div>
            <p style={{ color: "var(--theme-text-muted)", fontSize: 12, margin: 0 }}>Active requests</p>
            <strong style={{ color: "var(--theme-help)", fontSize: 23 }}>{activeBookings.length}</strong>
          </div>
          <div>
            <p style={{ color: "var(--theme-text-muted)", fontSize: 12, margin: 0 }}>Completed care</p>
            <strong style={{ color: "var(--theme-positive)", fontSize: 23 }}>{completedBookings.length}</strong>
          </div>
          <div>
            <p style={{ color: "var(--theme-text-muted)", fontSize: 12, margin: 0 }}>Care value completed</p>
            <strong style={{ color: "var(--theme-text)", fontSize: 18 }}>
              {formatNpr(completedBookings.reduce((total, booking) => total + Number(booking.totalAmount || 0), 0), "NPR 0")}
            </strong>
          </div>
        </div>
      </section>

      {activeBookings.length > 1 ? (
        <section className="card" aria-labelledby="customer-upcoming-care">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 id="customer-upcoming-care" style={{ color: "var(--theme-text)", fontSize: 18, margin: 0 }}>Other active requests</h2>
            <button type="button" className="btn btn-outline" onClick={() => navigate("/user/mybookings")}>All bookings</button>
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {activeBookings.slice(1, 4).map((booking) => (
              <button
                key={booking.id}
                type="button"
                onClick={() => navigate(`/user/bookings/${booking.id}`)}
                style={{ background: "transparent", border: "0", borderTop: "1px solid var(--theme-border)", color: "inherit", cursor: "pointer", display: "flex", justifyContent: "space-between", gap: 12, padding: "12px 0 0", textAlign: "left" }}
              >
                <span>
                  <strong style={{ color: "var(--theme-text)", display: "block", fontSize: 14 }}>{booking.caregiverName}</strong>
                  <small style={{ color: "var(--theme-text-muted)" }}>{bookingScheduleLabel(booking)}</small>
                </span>
                <StatusBadge status={booking.status} />
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
