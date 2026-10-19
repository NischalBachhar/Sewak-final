import React from "react";
import { Link } from "react-router-dom";
import useCustomerBookings from "./useCustomerBookings";
import { useAuth } from "./AuthContext";
import { bookingScheduleLabel, getBookingStatus } from "./bookingModel";
import { scheduleBoundary } from "./bookingValidation";
import { ErrorState, SkeletonCard, StatusBadge } from "./components/CareExperience";
import CustomerCareDiscovery from "./components/CustomerCareDiscovery";
import "./CustomerMarketplace.css";

export default function CustomerHomePage() {
  const { user } = useAuth();
  const { bookings, loading, error, stale } = useCustomerBookings(user?.uid);
  const active = bookings
    .filter(booking => ["pending", "accepted", "in_progress"].includes(booking.status))
    .sort((a,b) => (scheduleBoundary(a).getTime() || 0) - (scheduleBoundary(b).getTime() || 0));
  const recent = bookings.filter(booking => !active.includes(booking)).slice(0, 3);
  const rows = records => records.map(booking =>
    <Link className="home-booking-row" key={booking.id} to={`/user/bookings/${encodeURIComponent(booking.id)}`}>
      <span><strong>{booking.caregiverName || "Caregiver"}</strong><small>{booking.serviceLabel} · {bookingScheduleLabel(booking)}</small>
        {active.includes(booking) && <small>{getBookingStatus(booking.status).nextStep}</small>}</span><StatusBadge status={booking.status} />
    </Link>);
  return <main className="customer-home customer-marketplace sewak-customer-home" aria-label="Customer homepage">
    <header className="sewak-customer-intro">
      <div><p className="sewak-customer-eyebrow">WELCOME TO YOUR CARE SPACE</p>
        <h1>Find care for the people who matter.</h1>
        <p>Explore real local caregivers, compare profiles and request the help your family needs.</p></div>
      <div className="sewak-customer-intro-actions"><Link to="/user" className="sewak-customer-primary">Browse all caregivers <span aria-hidden="true">→</span></Link><Link to="/user/mybookings" className="sewak-customer-secondary">My bookings</Link></div>
    </header>
    <CustomerCareDiscovery />
    <section className="home-booking-activity sewak-care-activity" aria-labelledby="home-activity-heading">
      <div className="home-activity-heading"><div><p className="sewak-customer-eyebrow">STAY IN THE LOOP</p><h2 id="home-activity-heading">Your care & requests</h2></div><Link to="/user/mybookings">Manage bookings →</Link></div>
      {stale && <p role="status">Showing saved bookings. Reconnect for the latest care updates.</p>}
      {loading ? <SkeletonCard label="Loading booking activity" /> : error ? <ErrorState title="Bookings could not be loaded" description={error} actionLabel="Try again" onAction={() => window.location.reload()} /> : <div className="home-activity-grid"><section><h3>Upcoming care & requests</h3>{active.length ? rows(active.slice(0,3)) : <p>No upcoming care yet. Your requests and confirmed visits will appear here.</p>}</section><section><h3>Previous bookings</h3>{recent.length ? rows(recent) : <p>Your booking history will appear here after your first booking.</p>}</section></div>}
    </section>
  </main>;
}
