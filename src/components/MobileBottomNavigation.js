import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./MobileBottomNavigation.css";

const CUSTOMER_ITEMS = [
  { label: "Home", icon: "\u2302", path: "/user/home" },
  { label: "Browse", icon: "\u2315", path: "/user" },
  { label: "Bookings", icon: "\u25a3", path: "/user/mybookings" },
  { label: "Account", icon: "\u25ce", path: "/user/profile" },
];

const CAREGIVER_ITEMS = [
  { label: "Home", icon: "\u2302", path: "/caregiver?tab=home" },
  { label: "Jobs", icon: "\u25a3", path: "/caregiver?tab=jobs" },
  { label: "Schedule", icon: "\u25f7", path: "/caregiver?tab=schedule" },
  { label: "Earnings", icon: "\u20a8", path: "/caregiver?tab=earnings" },
  { label: "Profile", icon: "\u25ce", path: "/caregiver?tab=profile" },
];

function isActiveNavigationItem(item, location) {
  const [pathname, expectedSearch = ""] = item.path.split("?");
  if (location.pathname !== pathname) return false;
  if (!expectedSearch) return !location.search;

  const currentParams = new URLSearchParams(location.search);
  const expectedParams = new URLSearchParams(expectedSearch);
  return Array.from(expectedParams.entries()).every(
    ([key, value]) => currentParams.get(key) === value,
  );
}

export default function MobileBottomNavigation({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = role === "caregiver" ? CAREGIVER_ITEMS : role === "user" ? CUSTOMER_ITEMS : [];

  useEffect(() => {
    if (!items.length) return undefined;
    const root = document.getElementById("root");
    root?.classList.add("has-mobile-bottom-navigation");
    return () => root?.classList.remove("has-mobile-bottom-navigation");
  }, [items.length]);

  if (!items.length) return null;

  return (
    <nav
      className="mobile-bottom-navigation"
      aria-label={`${role === "caregiver" ? "Caregiver" : "Customer"} navigation`}
      style={{ "--mobile-navigation-items": items.length }}
    >
      {items.map((item) => {
        const active = isActiveNavigationItem(item, location);
        return (
          <button key={item.path} type="button" className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} onClick={() => navigate(item.path)}>
            <span aria-hidden="true">{item.icon}</span>
            <small>{item.label}</small>
          </button>
        );
      })}
    </nav>
  );
}
