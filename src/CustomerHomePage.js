import React from "react";
import { Link } from "react-router-dom";
import useCustomerBookings from "./useCustomerBookings";
import { useAuth } from "./AuthContext";
import { bookingScheduleLabel, getBookingStatus } from "./bookingModel";
import { scheduleBoundary } from "./bookingValidation";
import { ErrorState, SkeletonCard, StatusBadge } from "./components/CareExperience";
import CustomerCareDiscovery from "./components/CustomerCareDiscovery";
import { RoleCareHero } from "./components/CareHeroMedia";
import Sewak2ActionCenter from "./components/Sewak2ActionCenter";
import { useNavigate } from "react-router-dom";
import "./CustomerMarketplace.css";
export default function CustomerHomePage() {
  const {
    user
  } = useAuth();
  const {
    bookings,
    loading,
    error,
    stale
  } = useCustomerBookings(user?.uid);
  const active = bookings
    .filter(booking => ["pending", "accepted", "in_progress"].includes(booking.status))
    .sort((a, b) => (scheduleBoundary(a).getTime() || 0) - (scheduleBoundary(b).getTime() || 0));
  const recent = bookings.filter(booking => !active.includes(booking)).slice(0, 3);
  const rows = records => records.map(booking => <Link className="home-booking-row" key={booking.id} to={`/user/bookings/${encodeURIComponent(booking.id)}`}><span><strong>{booking.caregiverName || "Caregiver"}</strong><small>{booking.serviceLabel} · {bookingScheduleLabel(booking)}</small>{active.includes(booking) && <small>{getBookingStatus(booking.status).nextStep}</small>}</span><StatusBadge status={booking.status} /></Link>);
  return <main className="customer-home customer-marketplace" aria-label="Customer homepage">
    <header className="home-marketplace-heading"><p className="customer-home-eyebrow">YOUR CARE SPACE</p><h1>Find &amp; Book Care</h1><p>Compare caregivers and request local care.</p><nav className="home-marketplace-actions" aria-label="Care shortcuts"><Link className="customer-home-find-link" to="/user">Explore all caregivers <span aria-hidden="true">→</span></Link><Link className="customer-home-saved-link" to="/user/saved">♥ Saved caregivers →</Link><Link className="customer-home-saved-link" to="/user/jobs">Post a care job →</Link><Link className="customer-home-saved-link" to="/user/membership">Membership preview →</Link></nav></header>
    <CustomerCareDiscovery />
    <Sewak2ActionCenter role="user" onAction={action => navigate(({find:"/user",bookings:"/user/mybookings",inbox:"/user/inbox"})[action])} metrics={[{label:"Open care requests",value:active.filter(b=>b.status==="pending").length},{label:"Confirmed or ongoing",value:active.filter(b=>b.status!=="pending").length},{label:"Completed or past bookings",value:recent.length}]} />
    <RoleCareHero role="user" />
    <section className="home-booking-activity" aria-labelledby="home-activity-heading"><div className="home-activity-heading"><h2 id="home-activity-heading">Your booking activity</h2><Link to="/user/mybookings">Manage bookings &rarr;</Link></div>
      {stale && <p role="status">Showing saved bookings. Reconnect for the latest care updates.</p>}
      {loading ? <SkeletonCard label="Loading booking activity" /> : error ? <ErrorState title="Bookings could not be loaded" description={error} actionLabel="Try again" onAction={() => window.location.reload()} /> : <div className="home-activity-grid"><section><h3>Upcoming care &amp; requests</h3>{active.length ? rows(active.slice(0, 3)) : <p>No upcoming care yet. Your requests and confirmed visits will appear here.</p>}</section><section><h3>Recent bookings</h3>{recent.length ? rows(recent) : <p>Your booking history will appear here after your first booking.</p>}</section></div>}
    </section>
  </main>;
}
