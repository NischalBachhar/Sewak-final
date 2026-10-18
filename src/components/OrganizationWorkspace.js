import React, { useMemo, useState } from "react";
import { getBookingStatus, normalizeBooking } from "../bookingModel";
import AccessibleDialog from "./AccessibleDialog";
import "../OrganizationWorkspace.css";

const ICONS = {
  overview: "M3 3h8v8H3z M13 3h8v5h-8z M13 10h8v11h-8z M3 13h8v8H3z",
  team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
  calendar: "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M8 15h3 M8 18h7",
  heart: "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M9 12l2 2 4-4",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.05 2.05-.06-.06A1.7 1.7 0 0 0 15.8 18.6a1.7 1.7 0 0 0-1.4 1.65V21h-2.9v-.75A1.7 1.7 0 0 0 10.1 18.6a1.7 1.7 0 0 0-1.88.34l-.06.06-2.05-2.05.06-.06A1.7 1.7 0 0 0 6.5 15a1.7 1.7 0 0 0-1.65-1.4H4v-2.9h.85A1.7 1.7 0 0 0 6.5 9.3a1.7 1.7 0 0 0-.34-1.88L6.1 7.36l2.05-2.05.06.06A1.7 1.7 0 0 0 10.1 5.7a1.7 1.7 0 0 0 1.4-1.65V3h2.9v1.05a1.7 1.7 0 0 0 1.4 1.65 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.05 2.05-.06.06A1.7 1.7 0 0 0 19.4 9.3a1.7 1.7 0 0 0 1.65 1.4H22v2.9h-.95A1.7 1.7 0 0 0 19.4 15z",
  wallet: "M20 7H5a2 2 0 0 1 0-4h13 M3 5v14a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z M16 14h3",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  chevron: "M9 18l6-6-6-6",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.35-4.35",
  plus: "M12 5v14 M5 12h14",
  clock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 6v6l4 2",
  check: "M20 6L9 17l-5-5",
  alert: "M12 9v4 M12 17h.01 M10.3 3.9 1.8 18h20.4L13.7 3.9a2 2 0 0 0-3.4 0z",
  spark: "M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7z",
  filter: "M4 7h16 M7 12h10 M10 17h4",
  layers: "M12 2L2 8l10 6 10-6-10-6z M2 12l10 6 10-6 M2 16l10 6 10-6"
};
export function OrganizationIcon({ name, size = 19, className = "" }) {
  return <svg aria-hidden="true" focusable="false" className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={ICONS[name] || ICONS.overview}/></svg>;
}
export const ORGANIZATION_SECTIONS = [
  { key: "overview", label: "Overview", icon: "overview" },
  { key: "bookings", label: "Bookings", icon: "calendar" },
  { key: "caregivers", label: "Team members", icon: "team" },
  { key: "services", label: "Services", icon: "heart" },
  { key: "blacklist", label: "Safety records", icon: "shield" },
  { key: "profile", label: "Organization profile", icon: "settings" },
];
const initials = name => String(name || "?").trim().split(/\s+/).slice(0,2).map(part => part[0] || "").join("").toUpperCase();
const currency = amount => Number.isFinite(Number(amount)) ? "Rs. " + Number(amount).toLocaleString("en-NP", { maximumFractionDigits: 2 }) : "—";
const labelCategory = value => value === "both" ? "Caregiving + Household" : value === "vendor" || value === "household" ? "Household" : "Caregiving";
const niceDate = value => {
  if (!value) return "Date not set";
  const date = new Date(String(value).slice(0,10) + "T12:00:00+05:45");
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kathmandu" }).format(date);
};
export function OrganizationSidebar({ activeTab, onSelect, organizationName }) {
  return <aside className="org-sidebar" aria-label="Organization workspace">
    <div className="org-sidebar-brand">
      <span className="org-brand-symbol"><OrganizationIcon name="heart" size={23}/></span>
      <span><strong>Organization</strong><small>SEWAK WORKSPACE</small></span>
    </div>
    <div className="org-sidebar-switch"><span className="org-sidebar-avatar">{initials(organizationName)}</span><span><strong title={organizationName}>{organizationName || "Your organization"}</strong><small>Organization account</small></span></div>
    <span className="org-sidebar-caption">MANAGE</span>
    <nav className="org-sidebar-nav" aria-label="Organization sections">
      {ORGANIZATION_SECTIONS.map(item => <button type="button" key={item.key} className={"org-nav-link" + (activeTab === item.key ? " is-active" : "")} aria-current={activeTab === item.key ? "page" : undefined} onClick={() => onSelect(item.key)}><OrganizationIcon name={item.icon}/><span>{item.label}</span>{activeTab === item.key && <OrganizationIcon name="chevron" size={15}/>}</button>)}
    </nav>
    <div className="org-sidebar-footer"><OrganizationIcon name="shield" size={17}/><span>Care you can trust.<small>Secure organization workspace</small></span></div>
  </aside>;
}
export function OrganizationMobileNav({ activeTab, onSelect }) {
  return <nav className="org-mobile-nav" aria-label="Organization sections">{ORGANIZATION_SECTIONS.map(item => <button key={item.key} type="button" className={activeTab === item.key ? "is-active" : ""} aria-current={activeTab === item.key ? "page" : undefined} onClick={() => onSelect(item.key)}><OrganizationIcon name={item.icon} size={17}/>{item.label}</button>)}</nav>;
}
function Metric({ label, value, icon, detail, tone }) {
  return <div className={"org-metric org-metric--" + (tone || "default")}><div className="org-metric-title"><span>{label}</span><span className="org-metric-icon"><OrganizationIcon name={icon} size={19}/></span></div><strong>{value}</strong><small>{detail}</small></div>;
}
export function OrganizationOverview({ caregivers, services, bookingHistory, onSelect }) {
  const totals = bookingHistory.totals;
  const active = caregivers.filter(c => c.isAvailable && c.isApproved).length;
  const approved = caregivers.filter(c => c.isApproved).length;
  const total = totals.total;
  const done = totals.completed;
  const pageBookings = bookingHistory.filter ? [] : bookingHistory.rows;
  const pendingOnPage = pageBookings.filter(b => b.status === "pending").length;
  return <div className="org-overview">
    <div className="org-metric-grid">
      <Metric label="Total bookings" icon="calendar" value={total ?? "—"} detail="All booking records"/>
      <Metric label="Available team members" icon="team" value={active} detail={approved + " approved of " + caregivers.length + " total"}/>
      <Metric label="Completed jobs" icon="check" value={done ?? "—"} detail="Completed booking records" tone="success"/>
      <Metric label="Gross booking value" icon="wallet" value={currency(totals.revenue)} detail="Completed bookings only"/>
      <Metric label="Recorded earnings" icon="spark" value={currency(totals.earnings)} detail="Not a payout confirmation" tone="accent"/>
    </div>
    <div className="org-overview-columns">
      <section className="org-panel org-action-panel" aria-labelledby="org-actions-heading">
        <div className="org-panel-heading"><div><span className="org-eyebrow">OPERATIONS</span><h2 id="org-actions-heading">Your action center</h2><p>Shortcuts to work that deserves attention.</p></div><span className="org-panel-icon"><OrganizationIcon name="spark" size={20}/></span></div>
        <div className="org-action-list">
          <button onClick={() => onSelect("bookings")} type="button"><span className="org-action-symbol"><OrganizationIcon name="calendar"/></span><span><strong>Review booking requests</strong><small>{bookingHistory.filter ? "Open bookings to review pending requests" : pendingOnPage ? pendingOnPage + " pending on the loaded page" : "Check new requests and upcoming jobs"}</small></span><OrganizationIcon name="arrow" size={17}/></button>
          <button onClick={() => onSelect("caregivers")} type="button"><span className="org-action-symbol"><OrganizationIcon name="team"/></span><span><strong>Manage team availability</strong><small>{caregivers.length ? active + " available approved team members" : "Invite your first team member"}</small></span><OrganizationIcon name="arrow" size={17}/></button>
          <button onClick={() => onSelect("services")} type="button"><span className="org-action-symbol"><OrganizationIcon name="heart"/></span><span><strong>Manage service offerings</strong><small>{services.filter(s => s.isActive !== false).length ? services.filter(s => s.isActive !== false).length + " active service records" : "Add the services your organization provides"}</small></span><OrganizationIcon name="arrow" size={17}/></button>
        </div>
      </section>
      <section className="org-panel org-performance" aria-labelledby="org-performance-heading">
        <div className="org-panel-heading"><div><span className="org-eyebrow">AT A GLANCE</span><h2 id="org-performance-heading">Booking performance</h2><p>Based on your available records.</p></div></div>
        {typeof total === "number" && total > 0 && typeof done === "number" ? <>
          <div className="org-performance-total"><strong>{done}</strong><span>of {total} bookings completed</span></div>
          <div className="org-progress" role="progressbar" aria-label="Completed booking percentage" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(100 * done / total)}><span style={{ width: Math.min(100, Math.max(0, 100 * done / total)) + "%" }}/></div>
          <p className="org-performance-footnote">{Math.round(100 * done / total)}% of all recorded bookings are completed.</p>
        </> : <div className="org-overview-empty"><OrganizationIcon name="layers" size={30}/><strong>No booking performance yet</strong><p>Your completed bookings will appear here.</p></div>}
        <button className="org-subtle-link" type="button" onClick={() => onSelect("bookings")}>Explore bookings <OrganizationIcon name="arrow" size={17}/></button>
      </section>
    </div>
    <section className="org-panel org-overview-footer"><div><h2>Built around your care team</h2><p>Keep worker profiles, service categories and booking information accurate so your agency can serve families with confidence.</p></div><button type="button" className="org-primary-action" onClick={() => onSelect("caregivers")}>Manage your team <OrganizationIcon name="arrow" size={17}/></button></section>
  </div>;
}
export function OrganizationSectionHeader({ eyebrow, title, description, action }) {
  return <div className="org-section-heading"><div><span className="org-eyebrow">{eyebrow || "WORKSPACE"}</span><h2>{title}</h2><p>{description}</p></div>{action}</div>;
}
export function OrganizationTeamList({ caregivers, orgBlacklist, services, onEdit }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const filtered = useMemo(() => caregivers.filter(c => {
    const needle = search.trim().toLowerCase();
    const searchable = [c.name, c.location, c.email, c.phone].filter(Boolean).join(" ").toLowerCase();
    const matchCategory = category === "all" || c.category === category || (category === "household" && c.category === "vendor") || c.category === "both";
    const matchAvailability = availability === "all" || (availability === "available" ? Boolean(c.isAvailable && c.isApproved) : !(c.isAvailable && c.isApproved));
    return (!needle || searchable.includes(needle)) && matchCategory && matchAvailability;
  }).sort((a,b) => String(a.name || "").localeCompare(String(b.name || ""))), [caregivers, search, category, availability]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount - 1);
  const members = filtered.slice(currentPage * 10, currentPage * 10 + 10);
  return <div className="org-team-panel">
    <div className="org-toolbar"><label className="org-search"><OrganizationIcon name="search" size={18}/><span className="sr-only">Search team members</span><input value={search} onChange={e => {setSearch(e.target.value);setPage(0);}} placeholder="Search name, location or contact"/></label><label className="org-select-wrap"><span className="sr-only">Service category</span><select value={category} onChange={e => {setCategory(e.target.value);setPage(0);}}><option value="all">All categories</option><option value="caregiver">Caregiving</option><option value="household">Household</option></select></label><label className="org-select-wrap"><span className="sr-only">Availability</span><select value={availability} onChange={e => {setAvailability(e.target.value);setPage(0);}}><option value="all">All availability</option><option value="available">Available and approved</option><option value="unavailable">Not available</option></select></label></div>
    <div className="org-results-label">{filtered.length} team member{filtered.length === 1 ? "" : "s"} matched</div>
    {members.length === 0 ? <div className="org-no-results"><OrganizationIcon name="search" size={30}/><h3>No matching team members</h3><p>Adjust the search or filters to see more results.</p><button type="button" className="org-secondary-action" onClick={() => {setSearch("");setCategory("all");setAvailability("all");setPage(0);}}>Clear filters</button></div> : members.map(c => {
      const restricted = orgBlacklist.some(b => b.caregiverId === c.id);
      const status = restricted ? "Restricted" : !c.isApproved ? "Pending approval" : c.isAvailable ? "Available" : "Unavailable";
      return <article className="org-team-member" key={c.id}><div className="org-team-member-main"><div className="org-member-avatar">{initials(c.name)}</div><div className="org-member-info"><strong>{c.name || "Unnamed worker"}</strong><span>{labelCategory(c.category)} · {c.location || "Location not supplied"}</span></div><span className={"org-status " + (restricted ? "org-status-danger" : !c.isApproved ? "org-status-warning" : c.isAvailable ? "org-status-success" : "org-status-neutral")}>{status}</span><button type="button" className="org-details-button" aria-expanded={expanded === c.id} onClick={() => setExpanded(expanded === c.id ? null : c.id)}>{expanded === c.id ? "Hide details" : "View details"} <OrganizationIcon name="chevron" size={15}/></button></div>
      {expanded === c.id && <div className="org-member-details"><div><span>Contact</span><strong>{c.email || "Not supplied"}</strong><small>{c.phone || ""}</small></div><div><span>Work arrangement</span><strong>{c.workType === "fulltime" ? "Full-time" : "Part-time"}</strong><small>{Array.isArray(c.shifts) && c.shifts.length ? c.shifts.join(", ") : "No shifts listed"}</small></div><div><span>Rate and experience</span><strong>{currency(c.hourlyRate)} / hour</strong><small>{c.experience || 0} years experience · {c.jobsCompleted || 0} jobs</small></div><div><span>Services offered</span><strong>{(c.servicesOffered || []).map(id => services.find(s => s.id === id)?.label || id).join(", ") || "Not configured"}</strong></div><div><span>Verification progress</span><strong>{['identity','phone','training','background','references'].filter(k => c.verificationSource === 'audited_v1' && c[k+'VerificationStatus'] === 'verified').length} of 5 checks verified</strong><small>Private evidence is restricted to the worker and Sewak reviewers.</small></div>{onEdit && <button type="button" className="org-secondary-action" onClick={() => onEdit(c)}>Edit worker profile</button>}</div>}
      </article>;
    })}
    {filtered.length > 10 && <div className="org-pagination"><span>Page {currentPage+1} of {pageCount}</span><div><button className="org-secondary-action" type="button" disabled={currentPage===0} onClick={() => setPage(currentPage-1)}>Previous</button><button className="org-secondary-action" type="button" disabled={currentPage>=pageCount-1} onClick={() => setPage(currentPage+1)}>Next</button></div></div>}
  </div>;
}
export function OrganizationBookingsPanel({ bookingHistory }) {
  const [search,setSearch] = useState("");
  const [selected,setSelected] = useState(null);
  const bookings = bookingHistory.rows.map(normalizeBooking);
  const visible = bookings.filter(b => [b.id,b.caregiverName,b.userName,b.serviceLabel,b.userPhone].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="org-bookings-panel">
    <div className="org-toolbar"><label className="org-search"><OrganizationIcon name="search" size={18}/><span className="sr-only">Search bookings on current page</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search bookings on this page"/></label><label className="org-select-wrap"><span className="sr-only">Booking status</span><select value={bookingHistory.filter} onChange={e=>{setSearch("");setSelected(null);bookingHistory.setFilter(e.target.value);}}><option value="">All statuses</option>{["pending","accepted","in_progress","completed","cancelled","issue_reported"].map(status=><option key={status} value={status}>{getBookingStatus(status).label}</option>)}</select></label></div>
    {bookingHistory.stale && <p role="status" className="org-inline-note">Showing cached history. Reconnect to confirm current booking status.</p>}
    {bookingHistory.error && <p role="alert" className="org-inline-error">{bookingHistory.error}</p>}
    <div className="org-results-label">{bookingHistory.totals.matching ?? "—"} matching bookings overall · {visible.length} shown from this page · Up to 25 per page</div>
    {bookingHistory.loading ? <div role="status" className="org-loading-panel">Loading booking records…</div> : bookingHistory.error ? null : visible.length ? <div className="org-booking-table-wrap"><table className="org-booking-table"><thead><tr><th scope="col">Worker & customer</th><th scope="col">Schedule</th><th scope="col">Booking amount</th><th scope="col">Status</th><th scope="col">Details</th></tr></thead><tbody>{visible.map(b=><tr key={b.id}><td><strong>{b.caregiverName || "Unassigned"}</strong><small>Customer: {b.userName || "Not provided"}</small><small>{b.serviceLabel || "Service not specified"}</small></td><td><strong>{niceDate(b.date)}</strong><small>{b.time || "Time not set"}{b.durationHours ? " · " + b.durationHours + "h" : ""}</small></td><td><strong>{currency(b.totalAmount)}</strong>{b.status === "completed" && <small>Recorded earnings: {currency(b.vendorEarnings)}</small>}</td><td><span className={"org-status org-status-" + (b.status === "completed" ? "success" : b.status === "pending" ? "warning" : b.status === "cancelled" || b.status === "issue_reported" ? "danger" : "neutral")}>{getBookingStatus(b.status).label}</span></td><td><button type="button" className="org-details-button" onClick={()=>setSelected(b)}>View details <OrganizationIcon name="chevron" size={14}/></button></td></tr>)}</tbody></table></div> : <div className="org-no-results"><OrganizationIcon name="calendar" size={30}/><h3>{bookings.length ? "No matches on this page" : "No bookings to display"}</h3><p>{bookings.length ? "Try a different search, page or status." : "New organization bookings will appear here."}</p></div>}
    <div className="org-pagination"><span>Page navigation</span><div><button type="button" className="org-secondary-action" disabled={!bookingHistory.hasPrevious || bookingHistory.loading} onClick={()=>{setSelected(null);setSearch("");bookingHistory.previous();}}>Previous</button><button type="button" className="org-secondary-action" disabled={!bookingHistory.hasNext || bookingHistory.loading} onClick={()=>{setSelected(null);setSearch("");bookingHistory.next();}}>Next</button></div></div>
    {selected && <div className="org-dialog-backdrop" onMouseDown={event => {if(event.target === event.currentTarget) setSelected(null);}}><AccessibleDialog className="org-booking-detail" aria-labelledby="org-booking-details-title" onDismiss={() => setSelected(null)}><div className="org-detail-heading"><div><span className="org-eyebrow">BOOKING RECORD</span><h2 id="org-booking-details-title">Booking details</h2></div><button aria-label="Close booking details" type="button" className="org-secondary-action" onClick={()=>setSelected(null)}>Close</button></div><dl><div><dt>Status</dt><dd>{getBookingStatus(selected.status).label}</dd></div><div><dt>Booking ID</dt><dd className="org-break-word">{selected.id}</dd></div><div><dt>Assigned worker</dt><dd>{selected.caregiverName}</dd></div><div><dt>Customer</dt><dd>{selected.userName || "Not provided"}</dd></div><div><dt>Customer contact</dt><dd>{selected.userPhone || "Not provided"}</dd></div><div><dt>Service</dt><dd>{selected.serviceLabel}</dd></div><div><dt>Schedule</dt><dd>{niceDate(selected.date)} · {selected.time || "Time not set"}</dd></div><div><dt>Duration</dt><dd>{selected.durationHours ? selected.durationHours+" hours" : "Not specified"}</dd></div><div><dt>Booking value</dt><dd>{currency(selected.totalAmount)}</dd></div><div><dt>Recorded earnings</dt><dd>{selected.status === "completed" ? currency(selected.vendorEarnings) : "Calculated after completion"}</dd></div><div><dt>Payment status</dt><dd>{selected.paymentStatus || "Not available"}</dd></div></dl><p className="org-detail-help">This is a read-only view. Booking decisions and status changes must follow Sewak's authorized booking workflow.</p></AccessibleDialog></div>}
  </div>;
}
