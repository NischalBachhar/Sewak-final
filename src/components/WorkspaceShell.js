import React from "react";

/**
 * Shared, presentational workspace frame. Data, permissions, and actions stay in
 * the owning role dashboard; navigation is supplied by its existing route logic.
 */
const GLYPHS = {
  verification: <><path d="M12 3 20 6v6c0 4-3 7-8 10-5-3-8-6-8-10V6Z"/><path d="m8 12 3 3 5-6"/></>,
  home: <><path d="m3 10 9-7 9 7"/><path d="M5 9.5V21h14V9.5M9 21v-7h6v7"/></>,
  overview: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  jobs: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 5V3h8v2M3 11h18M10 11v3h4v-3"/></>,
  schedule: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15h3"/></>,
  profile: <><circle cx="12" cy="8" r="4"/><path d="M4.5 21c.5-4.5 3-7 7.5-7s7 2.5 7.5 7"/></>,
  earnings: <><rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/></>,
  organizations: <><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 21v-5h6v5M8 8h2M14 8h2M8 12h2M14 12h2"/></>,
  caregivers: <><circle cx="9" cy="8" r="3"/><path d="M2.5 20c0-4 2-6 6.5-6s6.5 2 6.5 6M17 5a3 3 0 0 1 0 6M18 14c2.5.3 3.5 2 3.5 5"/></>,
  bookings: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 15l2.5 2.5L16 13"/></>,
  services: <><path d="m14 5 5 5-9 9-5-5 9-9ZM16 3l5 5M3 21l5-1"/></>,
  blacklist: <><path d="M12 2.5 20 6v6c0 5-3.2 8.5-8 10-4.8-1.5-8-5-8-10V6l8-3.5Z"/><path d="m9 9 6 6m0-6-6 6"/></>,
  admins: <><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20v-2c0-3 3-5 7-5s7 2 7 5v2M17 5l1.5-1.5"/></>,
  analytics: <><path d="M4 20V12M10 20V5M16 20v-8M22 20V9M2 21h21"/></>,
};

export function WorkspaceIcon({ type, size = 19 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[type] || GLYPHS.overview}
    </svg>
  );
}

const MENU_LABELS = {
  verification: "My Verification",
  overview: "Overview",
  home: "Overview",
  jobs: "Job requests",
  schedule: "My schedule",
  profile: "My profile",
  earnings: "Earnings",
  organizations: "Organizations",
  caregivers: "Care professionals",
  bookings: "Bookings",
  services: "Services",
  blacklist: "Safety reports",
  admins: "Administrator access",
  analytics: "Analytics",
};

export default function WorkspaceShell({
  role,
  title,
  subtitle,
  activeTab,
  items,
  onSelect,
  children,
  alertCount = 0,
}) {
  const isAdmin = role === "admin";
  return (
    <div className={"sewak-workspace sewak-workspace--" + role}>
      <aside className="sewak-workspace__sidebar" aria-label={isAdmin ? "Superadmin workspace" : "Care professional workspace"}>
        <div className="sewak-workspace__identity">
          <div className="sewak-workspace__identity-icon" aria-hidden="true">S</div>
          <div>
            <strong>Sewak <span>{isAdmin ? "Control" : "Care"}</span></strong>
            <small>{isAdmin ? "Platform operations" : "Professional workspace"}</small>
          </div>
        </div>
        <p className="sewak-workspace__nav-heading">WORKSPACE</p>
        <nav className="sewak-workspace__nav" aria-label={isAdmin ? "Administration sections" : "Caregiver sections"}>
          {items.map(({ id, count, label }) => (
            <button
              key={id}
              type="button"
              className={"sewak-workspace__nav-item" + (activeTab === id ? " is-active" : "")}
              aria-current={activeTab === id ? "page" : undefined}
              onClick={() => onSelect(id)}
            >
              <WorkspaceIcon type={id} />
              <span>{label || MENU_LABELS[id] || id}</span>
              {typeof count === "number" && count > 0 ? <em>{count > 99 ? "99+" : count}</em> : null}
            </button>
          ))}
        </nav>
        <div className="sewak-workspace__sidebar-foot">
          <span className="sewak-workspace__sidebar-foot-icon" aria-hidden="true">♥</span>
          <p><strong>Care comes first</strong><small>{isAdmin ? "Review with care. Act with accountability." : "Every session makes a difference."}</small></p>
        </div>
      </aside>

      <div className="sewak-workspace__content">
        <div className="sewak-workspace__intro">
          <div>
            <p className="sewak-workspace__eyebrow">{isAdmin ? "SEWAK PLATFORM" : "YOUR WORKSPACE"}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <div className="sewak-workspace__intro-status">
            <span className="sewak-workspace__status-dot" aria-hidden="true" />
            {alertCount > 0 ? alertCount + " item" + (alertCount === 1 ? "" : "s") + " to review" : "Your workspace"}
          </div>
        </div>
        <div className="sewak-workspace__body">{children}</div>
      </div>
    </div>
  );
}
