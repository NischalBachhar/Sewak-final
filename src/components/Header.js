import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logoSvg from "../assets/sewak-care-mark.svg";
import "./Header.css";
import { WorkspaceIcon } from "./WorkspaceShell";
import CareNotificationsBell from "./CareNotificationsBell";

export default function Header({ user, userRole, userDoc, onLogout, logoutPending, logoutError, onBrowseCaregivers, onMyBookings, notificationCount }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMenu]);

  if (!user) return null;

  const getRoleIcon = (role) => <WorkspaceIcon type={role === 'superadmin' ? 'admins' : role === 'orgadmin' ? 'organizations' : 'profile'} />;

  const getRoleLabel = (role) => {
    switch (role) {
      case "user":
        return "Customer";
      case "caregiver":
        return "Caregiver";
      case "orgadmin":
        return "Organization";
      case "superadmin":
        return "SuperAdmin";
      default:
        return "User";
    }
  };

  const handleNavigate = (path) => {
    navigate(path);
    setShowMenu(false);
  };

  const handleLogout = async () => {
    await onLogout();
  };

  return (
    <header className={"header header--" + (userRole || "guest")}>
      {logoutError && <p role="alert">{logoutError}</p>}
      <div className="header-container">
        <button
          type="button"
          className="header-logo"
          onClick={() => handleNavigate(userRole === "user" && userDoc?.profileComplete ? "/user/home" : "/")}
          aria-label="Go to Sewak home"
        >
          <img src={logoSvg} alt="" className="header-logo-img" />
          <span className="header-logo-text">Sewak</span>
        </button>

        {userRole === "user" && userDoc?.profileComplete && (
          <nav className="header-customer-nav" aria-label="Customer pages">
            <button
              type="button"
              className={"header-customer-nav__item" + (location.pathname === "/user/home" ? " is-active" : "")}
              aria-current={location.pathname === "/user/home" ? "page" : undefined}
              onClick={() => handleNavigate("/user/home")}
            >Home</button>
            <button
              type="button"
              className={"header-customer-nav__item" + (location.pathname === "/user" ? " is-active" : "")}
              aria-current={location.pathname === "/user" ? "page" : undefined}
              onClick={() => onBrowseCaregivers ? onBrowseCaregivers() : handleNavigate("/user")}
            >Find Care</button>
            <button type="button" className={"header-customer-nav__item" + (location.pathname === "/user/saved" ? " is-active" : "")} aria-current={location.pathname === "/user/saved" ? "page" : undefined} onClick={() => handleNavigate("/user/saved")}>Saved</button>
            <button type="button" className={"header-customer-nav__item" + (location.pathname === "/user/jobs" ? " is-active" : "")} aria-current={location.pathname === "/user/jobs" ? "page" : undefined} onClick={() => handleNavigate("/user/jobs")}>Post a job</button>
            <button type="button" className={"header-customer-nav__item" + (location.pathname.startsWith("/user/inbox") || location.pathname.startsWith("/user/messages/") ? " is-active" : "")} aria-current={location.pathname === "/user/inbox" ? "page" : undefined} onClick={() => handleNavigate("/user/inbox")}>Messages</button>
            <button
              type="button"
              className={"header-customer-nav__item header-customer-nav__item--bookings" + (location.pathname.startsWith("/user/mybookings") || location.pathname.startsWith("/user/bookings/") ? " is-active" : "")}
              aria-current={location.pathname === "/user/mybookings" ? "page" : undefined}
              onClick={() => onMyBookings ? onMyBookings() : handleNavigate("/user/mybookings")}
            >My Bookings{notificationCount > 0 && <span className="header-customer-nav__count">{notificationCount}</span>}</button>
          </nav>
        )}

        <CareNotificationsBell role={userRole} />
        {/* User Menu */}
        <div className="header-menu" ref={menuRef}>
          <button
            type="button"
            className="header-user-button"
            onClick={() => setShowMenu(!showMenu)}
            aria-expanded={showMenu}
            aria-controls="header-account-menu"
            aria-label={`Account menu for ${userDoc?.name || user.email}`}
          >
            <span className="header-user-avatar">{getRoleIcon(userRole)}</span>
            <span className="header-user-name">{userDoc?.name || user.email}</span>
            <span className="header-user-role">{getRoleLabel(userRole)}</span>
            {notificationCount > 0 && (
              <span
                style={{
                  marginLeft: 8,
                  backgroundColor: "var(--theme-danger)",
                  color: "white",
                  borderRadius: 999,
                  padding: "2px 8px",
                  fontSize: 12,
                  fontWeight: "bold",
                }}
              >
                {notificationCount}
              </span>
            )}
            <span style={{ fontSize: 16, marginLeft: 4 }}>{showMenu ? "▲" : "▼"}</span>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <>
              {/* Backdrop */}
              <div
                className="header-backdrop"
                onClick={() => setShowMenu(false)}
                aria-hidden="true"
              />
              
              <div id="header-account-menu" className="header-dropdown">
                {/* User Info */}
                <div className="dropdown-header">
                  <p style={{ margin: 0, color: "var(--theme-text)", fontSize: 13 }}>
                    <strong>{userDoc?.name}</strong>
                  </p>
                  <p style={{ margin: 0, color: "var(--theme-text-muted)", fontSize: 12 }}>
                    {user.email}
                  </p>
                  {userRole === "caregiver" && userDoc?.organizationName && (
                    <p style={{ margin: "4px 0 0 0", color: "var(--theme-text-muted)", fontSize: 11 }}>
                      {userDoc.organizationName}
                    </p>
                  )}
                  {userRole === "orgadmin" && userDoc?.organizationName && (
                    <p style={{ margin: "4px 0 0 0", color: "var(--theme-text-muted)", fontSize: 11 }}>
                      {userDoc.organizationName}
                    </p>
                  )}
                </div>

                <div className="dropdown-divider"></div>

                {/* Navigation Items - User/Customer */}
                {userRole === "user" && (
                  <>
                    <button type="button" className="dropdown-item" onClick={() => handleNavigate("/user/home")}>
                      My Dashboard
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        if (onBrowseCaregivers) {
                          onBrowseCaregivers();
                        } else {
                          handleNavigate("/user");
                        }
                      }}
                    >
                      Browse Caregivers
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        if (onMyBookings) {
                          onMyBookings();
                        } else {
                          handleNavigate("/user");
                        }
                      }}
                    >
                      My Bookings{notificationCount > 0 ? ` (${notificationCount})` : ""}
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/user/profile")}
                    >
                      My Profile
                    </button>
                  </>
                )}

                {/* Navigation Items - Caregiver */}
                {userRole === "caregiver" && (
                  <>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/caregiver?tab=jobs")}
                    >
                      Job Dashboard
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/caregiver?tab=profile")}
                    >
                      My Profile
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/caregiver?tab=earnings")}
                    >
                      My Earnings
                    </button>
                  </>
                )}

                {userRole === "caregiver" && <button type="button" className="dropdown-item" onClick={() => handleNavigate("/caregiver/opportunities")}>Find care jobs</button>}
                {userRole === "caregiver" && <button type="button" className="dropdown-item" onClick={() => handleNavigate("/caregiver/availability")}>Manage availability</button>}
                {(userRole === "caregiver" || userRole === "user") && <button type="button" className="dropdown-item" onClick={() => handleNavigate(userRole === "caregiver" ? "/caregiver/inbox" : "/user/inbox")}>Messages</button>}
                {userRole === "user" && <button type="button" className="dropdown-item" onClick={() => handleNavigate("/user/jobs")}>Post a care job</button>}
                {userRole === "user" && <button type="button" className="dropdown-item" onClick={() => handleNavigate("/user/saved")}>Saved caregivers</button>}
                {/* Organization navigation lives in its dedicated sidebar/mobile workspace. */}
                {userRole === "orgadmin" && (
                  <>
                    <button type="button" className="dropdown-item" onClick={() => handleNavigate("/organization?tab=overview")}>Organization workspace</button>
                    <button type="button" className="dropdown-item" onClick={() => handleNavigate("/organization?tab=profile")}>Organization settings</button>
                  </>
                )}

                {/* Navigation Items - SuperAdmin */}
                {userRole === "superadmin" && (
                  <>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/organizations")}
                    >
                      All Organizations
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/caregivers")}
                    >
                      All Caregivers
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/bookings")}
                    >
                      All Bookings
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/services")}
                    >
                      Services
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/blacklist")}
                    >
                      Reports
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/analytics")}
                    >
                      Settings
                    </button>
                  </>
                )}

                <div className="dropdown-divider"></div>

                {/* Logout */}
                <button type="button" className="dropdown-item logout" onClick={handleLogout} disabled={logoutPending}>
                  Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
