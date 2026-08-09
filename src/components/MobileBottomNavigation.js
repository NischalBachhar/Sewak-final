import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./MobileBottomNavigation.css";

const CUSTOMER_ITEMS = [
  { label: "Browse", icon: "⌕", path: "/user" },
  { label: "Bookings", icon: "▣", path: "/user/mybookings" },
  { label: "Account", icon: "◉", path: "/user/profile" },
];

const CAREGIVER_ITEMS = [
  { label: "Jobs", icon: "▣", path: "/caregiver?tab=jobs" },
  { label: "Earnings", icon: "₨", path: "/caregiver?tab=earnings" },
  { label: "Profile", icon: "◉", path: "/caregiver?tab=profile" },
];

export default function MobileBottomNavigation({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const items = role === "caregiver" ? CAREGIVER_ITEMS : role === "user" ? CUSTOMER_ITEMS : [];

  if (!items.length) return null;

  return (
    <nav className="mobile-bottom-navigation" aria-label={`${role === "caregiver" ? "Caregiver" : "Customer"} navigation`}>
      {items.map((item) => {
        const active = item.path.split("?")[0] === "/user"
          ? location.pathname === "/user" || location.pathname === "/user/"
          : location.pathname === item.path.split("?")[0] && (!item.path.includes("?") || location.search === `?${item.path.split("?")[1]}`);
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
