import React, { useMemo } from "react";
import useCustomerBookings from "./useCustomerBookings";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { bookingScheduleLabel, getBookingStatus } from "./bookingModel";
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
  const { bookings: records, loading, error, stale } = useCustomerBookings(user?.uid);
  const bookings = useMemo(
    () => [...records].sort((a, b) => bookingDateTime(a) - bookingDateTime(b)),
    [records],
  );
  const activeBookings = bookings.filter((booking) =>
    ["pending", "accepted", "in_progress"].includes(booking.status),
  );
  const completedBookings = bookings.filter((booking) => booking.status === "completed");
  const nextBooking = activeBookings[0] || null;
  const recentBookings = [...bookings].reverse().slice(0, 3);
  const completedValue = completedBookings.reduce(
    (total, booking) => total + Number(booking.totalAmount || 0), 0,
  );
  const displayName = String(userDoc?.name || "").trim().split(/\s+/)[0] || "there";

  if (loading) {
    return (
      <main className="customer-home customer-home--loading" aria-busy="true" aria-label="Loading your care overview">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </main>
    );
  }

  if (error) {
    return (
      <main className="customer-home">
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
    <main className="customer-home" aria-label="Customer dashboard">
      {stale && <p className="customer-home__stale" role="status">Showing saved bookings. Reconnect to see the latest care updates.</p>}
      <section className="customer-welcome" aria-labelledby="customer-home-title">
        <div className="customer-welcome__content">
          <p className="customer-eyebrow"><span className="customer-eyebrow__dot" aria-hidden="true" /> Sewak care dashboard</p>
          <h1 id="customer-home-title">Hello, {displayName}<span className="customer-welcome__spark" aria-hidden="true"> ✨</span></h1>
          <p>Care for your loved ones, made simpler. Find trusted support and keep every care update in one calm place.</p>
          <div className="customer-welcome__actions">
            <button type="button" className="customer-action customer-action--primary" onClick={() => navigate("/user")}>
              <span aria-hidden="true">⌕</span> Find care <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="customer-action customer-action--light" onClick={() => navigate("/user/mybookings")}>
              View my bookings <span aria-hidden="true">↗</span>
            </button>
          </div>
        </div>
        <div className="customer-welcome__visual" aria-hidden="true">
          <div className="customer-welcome__halo" />
          <div className="customer-welcome__heart">♥</div>
          <div className="customer-welcome__floating customer-welcome__floating--top">✦ Care made personal</div>
          <div className="customer-welcome__floating customer-welcome__floating--bottom">✓ Here when you need us</div>
        </div>
      </section>

      <section className="customer-summary" aria-label="Your care overview">
        <div className="customer-summary__item">
          <span className="customer-summary__icon customer-summary__icon--teal" aria-hidden="true">▦</span>
          <div><p>Active requests</p><strong>{activeBookings.length}</strong><small>Care being arranged</small></div>
        </div>
        <div className="customer-summary__item">
          <span className="customer-summary__icon customer-summary__icon--blue" aria-hidden="true">✓</span>
          <div><p>Completed care</p><strong>{completedBookings.length}</strong><small>Finished sessions</small></div>
        </div>
        <div className="customer-summary__item">
          <span className="customer-summary__icon customer-summary__icon--gold" aria-hidden="true">रू</span>
          <div><p>Completed care value</p><strong className="customer-summary__currency">{formatNpr(completedValue, "NPR 0")}</strong><small>Booking value, not payments</small></div>
        </div>
      </section>

      <div className="customer-home__grid">
        <section className="customer-panel customer-panel--next" aria-labelledby="customer-next-care">
          <div className="customer-panel__heading">
            <div><p className="customer-eyebrow">Stay in the loop</p><h2 id="customer-next-care">Your next care</h2></div>
            {nextBooking && <StatusBadge status={nextBooking.status} />}
          </div>
          {nextBooking ? (
            <>
              <div className="customer-next">
                <span className="customer-next__avatar" aria-hidden="true">♥</span>
                <div className="customer-next__info">
                  <h3>{nextBooking.caregiverName || "Your caregiver"}</h3>
                  <p>{nextBooking.serviceLabel || "Care service"}</p>
                  <p className="customer-next__schedule">◷ {bookingScheduleLabel(nextBooking)}</p>
                </div>
              </div>
              <div className="customer-next__step">
                <span aria-hidden="true">✦</span>
                <p><strong>What happens next</strong><span>{getBookingStatus(nextBooking.status).nextStep}</span></p>
              </div>
              <button type="button" className="customer-action customer-action--outline customer-action--wide" onClick={() => navigate("/user/bookings/" + nextBooking.id)}>
                View care details <span aria-hidden="true">→</span>
              </button>
            </>
          ) : (
            <div className="customer-next__empty">
              <div className="customer-next__empty-icon" aria-hidden="true">♡</div>
              <h3>No upcoming care yet</h3>
              <p>When you book support, your next care visit and important updates will appear here.</p>
              <button type="button" className="customer-action customer-action--outline" onClick={() => navigate("/user")}>Find a caregiver <span aria-hidden="true">→</span></button>
            </div>
          )}
        </section>

        <section className="customer-panel customer-panel--shortcuts" aria-labelledby="customer-actions-heading">
          <div className="customer-panel__heading">
            <div><p className="customer-eyebrow">Easy access</p><h2 id="customer-actions-heading">How can we help?</h2></div>
          </div>
          <div className="customer-shortcuts">
            <button type="button" className="customer-shortcut" onClick={() => navigate("/user")}>
              <span className="customer-shortcut__icon customer-shortcut__icon--teal" aria-hidden="true">♡</span>
              <span><strong>Find care support</strong><small>Browse caregivers and household help</small></span>
              <span aria-hidden="true">↗</span>
            </button>
            <button type="button" className="customer-shortcut" onClick={() => navigate("/user/mybookings")}>
              <span className="customer-shortcut__icon customer-shortcut__icon--blue" aria-hidden="true">▦</span>
              <span><strong>Manage bookings</strong><small>Track requests, care and payments</small></span>
              <span aria-hidden="true">↗</span>
            </button>
            <button type="button" className="customer-shortcut" onClick={() => navigate("/user/profile")}>
              <span className="customer-shortcut__icon customer-shortcut__icon--gold" aria-hidden="true">◉</span>
              <span><strong>Update your profile</strong><small>Keep contact and location details ready</small></span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </section>
      </div>

      <section className="customer-panel customer-panel--recent" aria-labelledby="customer-recent-heading">
        <div className="customer-panel__heading">
          <div><p className="customer-eyebrow">Your activity</p><h2 id="customer-recent-heading">Recent bookings</h2></div>
          <button type="button" className="customer-text-link" onClick={() => navigate("/user/mybookings")}>View all <span aria-hidden="true">→</span></button>
        </div>
        {recentBookings.length ? (
          <div className="customer-recent-list">
            {recentBookings.map((booking) => (
              <button type="button" className="customer-recent-item" key={booking.id} onClick={() => navigate("/user/bookings/" + booking.id)}>
                <span className="customer-recent-item__icon" aria-hidden="true">♡</span>
                <span className="customer-recent-item__content"><strong>{booking.caregiverName || "Caregiver"}</strong><small>{bookingScheduleLabel(booking)}</small></span>
                <StatusBadge status={booking.status} />
                <span className="customer-recent-item__arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="customer-recent-empty">Your care history will appear here after your first booking.</p>
        )}
      </section>
    </main>
  );
}
