import React from "react";
import { Link } from "react-router-dom";
import useCustomerBookings from "./useCustomerBookings";
import { useAuth } from "./AuthContext";
import { bookingScheduleLabel, getBookingStatus } from "./bookingModel";
import { scheduleBoundary } from "./bookingValidation";
import { ErrorState, SkeletonCard, StatusBadge } from "./components/CareExperience";
import CustomerCareDiscovery from "./components/CustomerCareDiscovery";
import { RoleCareHero } from "./components/CareHeroMedia";
import "./CustomerMarketplace.css";
export default function CustomerHomePage() {
  const { user } = useAuth();
  const { bookings, loading, error, stale } = useCustomerBookings(user?.uid);
  const active = bookings.filter(booking => ["pending", "accepted", "in_progress"].includes(booking.status))
    .sort((a,b) => (scheduleBoundary(a).getTime() || 0) - (scheduleBoundary(b).getTime() || 0));
  const recent = bookings.filter(booking => !active.includes(booking)).slice(0,3);
  const row = booking => <Link className="home-booking-row" key={booking.id} to={`/user/bookings/${encodeURIComponent(booking.id)}`}><span><strong>{booking.caregiverName || "Caregiver"}</strong><small>{booking.serviceLabel} · {bookingScheduleLabel(booking)}</small><small>{getBookingStatus(booking.status).nextStep}</small></span><StatusBadge status={booking.status} /></Link>;
  return <main className="customer-home customer-marketplace" aria-label="Customer homepage">
    <header className="home-marketplace-heading"><p className="customer-home-eyebrow">YOUR CARE SPACE</p><h1>Find &amp; Book Care</h1><p>Compare caregivers and request local care.</p></header>
    {(loading || error || active.length > 0) && <section className="home-booking-activity home-booking-activity--priority" aria-labelledby="home-activity-heading">
      <div className="home-activity-heading"><h2 id="home-activity-heading">Your upcoming care</h2><Link to="/user/mybookings">All bookings →</Link></div>
      {stale && <p role="status">Showing saved bookings. Reconnect for the latest care updates.</p>}
      {loading ? <SkeletonCard label="Loading booking activity" /> : error ? <ErrorState title="Bookings could not be loaded" description={error} actionLabel="Try again" onAction={() => window.location.reload()} /> : row(active[0])}
      {!loading && !error && active.length > 1 && <Link className="care-profile-link" to="/user/mybookings">View {active.length - 1} more active {active.length === 2 ? 'request' : 'requests'}</Link>}
    </section>}
    <CustomerCareDiscovery />
    <nav className="home-marketplace-actions" aria-label="Care shortcuts"><Link to="/user/saved">Saved caregivers →</Link><Link to="/user/jobs">Post a care job →</Link><Link to="/user/inbox">Messages →</Link><Link to="/user/membership">Membership preview →</Link></nav>
    {recent.length > 0 && <details className="home-recent-care"><summary>Recent bookings</summary>{recent.map(row)}<Link to="/user/mybookings">View booking history →</Link></details>}
    <RoleCareHero role="user" />
  </main>;
}
