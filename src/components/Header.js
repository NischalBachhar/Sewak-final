import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logoSvg from "../logoSewak.jpeg";
import "./Header.css";

export default function Header({ user, userRole, userDoc, onLogout, onBrowseCaregivers, onMyBookings, notificationCount }) {
  const navigate = useNavigate();
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

  const getRoleIcon = (role) => {
    switch (role) {
      case "user":
        return "👨‍👩‍👧";
      case "caregiver":
        return "👩‍💼";
      case "orgadmin":
        return "🏢";
      case "superadmin":
        return "🔐";
      default:
        return "👤";
    }
  };

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

  const handleLogout = () => {
    onLogout();
    setShowMenu(false);
    navigate("/browse");
  };

  return (
    <header className="header">
      <div className="header-container">
        {/* Logo */}
            <div
              className="header-logo"
              onClick={() => handleNavigate("/")}
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
            >
              <img src={logoSvg} alt="Sewak" className="header-logo-img" />
              <h1 style={{ margin: 0, color: "var(--theme-help)", fontSize: 22 }}>Sewak</h1>
            </div>

        {/* User Menu */}
        <div className="header-menu" ref={menuRef}>
          <button
            type="button"
            className="header-user-button"
            onClick={() => setShowMenu(!showMenu)}
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
              />
              
              <div className="header-dropdown">
                {/* User Info */}
                <div className="dropdown-header">
                  <p style={{ margin: 0, color: "var(--theme-button-text)", fontSize: 13 }}>
                    <strong>{userDoc?.name}</strong>
                  </p>
                  <p style={{ margin: 0, color: "var(--theme-text-muted)", fontSize: 12 }}>
                    {user.email}
                  </p>
                  {userRole === "caregiver" && userDoc?.organizationName && (
                    <p style={{ margin: "4px 0 0 0", color: "var(--theme-text-muted)", fontSize: 11 }}>
                      🏢 {userDoc.organizationName}
                    </p>
                  )}
                  {userRole === "orgadmin" && userDoc?.organizationName && (
                    <p style={{ margin: "4px 0 0 0", color: "var(--theme-text-muted)", fontSize: 11 }}>
                      🏢 {userDoc.organizationName}
                    </p>
                  )}
                </div>

                <div className="dropdown-divider"></div>

                {/* Navigation Items - User/Customer */}
                {userRole === "user" && (
                  <>
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
                      📋 Browse Caregivers
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
                      📅 My Bookings{notificationCount > 0 ? ` (${notificationCount})` : ""}
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/user/profile")}
                    >
                      👤 My Profile
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
                      📊 Job Dashboard
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/caregiver?tab=profile")}
                    >
                      👤 My Profile
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/caregiver?tab=earnings")}
                    >
                      💰 My Earnings
                    </button>
                  </>
                )}

                {/* Navigation Items - Organization Admin */}
                {userRole === "orgadmin" && (
                  <>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/organization?tab=caregivers")}
                    >
                      👥 Manage Caregivers
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/organization?tab=bookings")}
                    >
                      📅 All Bookings
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/organization?tab=services")}
                    >
                      🛠️ Services
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/organization?tab=blacklist")}
                    >
                      🚫 Blacklist
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/organization?tab=profile")}
                    >
                      🏢 Organization Profile
                    </button>
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
                      🏢 All Organizations
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/caregivers")}
                    >
                      👥 All Caregivers
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/bookings")}
                    >
                      📅 All Bookings
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/services")}
                    >
                      🛠️ Services
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/blacklist")}
                    >
                      🚫 Reports
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => handleNavigate("/superadmin/analytics")}
                    >
                      ⚙️ Settings
                    </button>
                  </>
                )}

                <div className="dropdown-divider"></div>

                {/* Logout */}
                <button type="button" className="dropdown-item logout" onClick={handleLogout}>
                  🚪 Logout
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
