import React, { useState, useEffect, useRef } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import AuthPage from "./AuthPage";
import UserProfilePage from "./UserProfilePage";
import OrganizationProfilePage from "./OrganizationProfilePage";
import CaregiverProfilePage from "./CaregiverProfilePage";
import CaregiverDashboardPage from "./CaregiverDashboardPage";
import CaregiverListPage from "./CaregiverListPage";
import BookingFormPage from "./BookingFormPage";
import MyBookingsPage from "./MyBookingsPage";
import AdminDashboardPage from "./AdminDashboardPage";
import OrganizationDashboard from "./OrganizationDashboard";
import CaregiverReportUserPage from "./CaregiverReportUserPage";
import BrowsePage from "./BrowsePage";
import Header from "./components/Header";
import { signOut } from "firebase/auth";
import { auth } from "./firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "./firebaseConfig";
import "./App.css";

function App() {
  const { user, loading, userRole, userDoc } = useAuth();
  const [selectedCaregiver, setSelectedCaregiver] = useState(null);
  const [showMyBookings, setShowMyBookings] = useState(false);
  const [userCategory, setUserCategory] = useState("");
  const [userWorkType, setUserWorkType] = useState("");
  const [userShift, setUserShift] = useState("");
  const [notificationCount, setNotificationCount] = useState(0);
  const bookingsSnapshotRef = useRef([]);
  const bookingsInitialLoadRef = useRef(true);
  const seenCompletedIdsRef = useRef([]);
  const navigate = useNavigate();

  const parseSavedIds = (value) => {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setSelectedCaregiver(null);
      setShowMyBookings(false);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleBrowseCaregivers = () => {
    setSelectedCaregiver(null);
    setShowMyBookings(false);
    navigate("/user");
  };

  const handleMyBookings = () => {
    setSelectedCaregiver(null);
    setShowMyBookings(false);

    const currentCompletedIds = bookingsSnapshotRef.current
      .filter((booking) => booking.status === "completed")
      .map((booking) => booking.id);

    if (user?.uid) {
      const storageKey = `seenCompletedBookings_${user.uid}`;
      const stored = localStorage.getItem(storageKey);
      const storedIds = parseSavedIds(stored);
      const mergedIds = Array.from(new Set([...(storedIds || []), ...currentCompletedIds]));
      localStorage.setItem(storageKey, JSON.stringify(mergedIds));
      seenCompletedIdsRef.current = mergedIds;
    }

    setNotificationCount(0);
    navigate("/user/mybookings");
  };

  useEffect(() => {
    if (!user || userRole !== "user") return;

    const storageKey = `seenCompletedBookings_${user.uid}`;
    const stored = localStorage.getItem(storageKey);
    seenCompletedIdsRef.current = parseSavedIds(stored);

    const q = query(
      collection(db, "bookings"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const currentCompletedIds = docs
        .filter((booking) => booking.status === "completed")
        .map((booking) => booking.id);
      const unseenCompleted = currentCompletedIds.filter(
        (id) => !seenCompletedIdsRef.current.includes(id)
      );

      if (!bookingsInitialLoadRef.current) {
        setNotificationCount(unseenCompleted.length);
      } else {
        if (stored) {
          setNotificationCount(unseenCompleted.length);
        } else {
          setNotificationCount(0);
          seenCompletedIdsRef.current = currentCompletedIds;
          localStorage.setItem(storageKey, JSON.stringify(currentCompletedIds));
        }
      }

      bookingsSnapshotRef.current = docs;
      bookingsInitialLoadRef.current = false;
    });

    return () => {
      unsubscribe();
      bookingsSnapshotRef.current = [];
      bookingsInitialLoadRef.current = true;
    };
  }, [user, userRole]);

  useEffect(() => {
    if (!user || !userRole) return;

    const path = window.location.pathname;

    if (userRole === "orgadmin") {
      // If profile is complete but on profile page, redirect to dashboard
      if (userDoc?.profileComplete && path === "/organization/profile") {
        navigate("/organization/dashboard", { replace: true });
      } 
      // If profile is incomplete but on dashboard, redirect to profile
      else if (!userDoc?.profileComplete && path === "/organization/dashboard") {
        navigate("/organization/profile", { replace: true });
      }
      // If on neutral pages, redirect based on profile status
      else if (path === "/" || path === "/browse" || path === "/auth") {
        if (userDoc?.profileComplete) {
          navigate("/organization/dashboard", { replace: true });
        } else {
          navigate("/organization/profile", { replace: true });
        }
      }
    } else if (userRole === "user") {
      // If profile is complete but on profile page, redirect to browse
      if (userDoc?.profileComplete && path === "/user/profile") {
        navigate("/user", { replace: true });
      }
      // If profile is incomplete but on browse/main page, redirect to profile
      else if (!userDoc?.profileComplete && (path === "/user" || path === "/user/")) {
        navigate("/user/profile", { replace: true });
      }
      // If on neutral pages, redirect to profile (user must complete profile first)
      else if (path === "/" || path === "/browse" || path === "/auth") {
        navigate("/user/profile", { replace: true });
      }
    }
  }, [user, userRole, userDoc?.profileComplete, navigate]);

  useEffect(() => {
    if (
      !user ||
      userRole !== "user" ||
      !userDoc?.profileComplete ||
      selectedCaregiver
    ) {
      return;
    }

    try {
      const savedCaregiver = localStorage.getItem("pendingBookingCaregiver");
      if (!savedCaregiver) return;

      const caregiver = JSON.parse(savedCaregiver);
      localStorage.removeItem("pendingBookingCaregiver");

      if (caregiver && typeof caregiver === "object") {
        setSelectedCaregiver(caregiver);
        navigate("/user", { replace: true });
      }
    } catch {
      localStorage.removeItem("pendingBookingCaregiver");
    }
  }, [user, userRole, userDoc?.profileComplete, selectedCaregiver, navigate]);

  // Global loading state while Firebase auth initializes
  if (loading) {
    return (
      <div className="centered-message">
        <p>Loading...</p>
      </div>
    );
  }

  // Prevent routing until Firestore userRole is known
  if (user && !userRole) {
    return (
      <div className="centered-message">
        <p>Loading your dashboard...</p>
      </div>
    );
  }

  // NOT LOGGED IN - PUBLIC ROUTES
  if (!user) {
    return (
      <Routes>
        <Route
          path="/browse"
          element={<BrowsePage />}
        />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/caregiver/reportuser"
          element={<CaregiverReportUserPage />}
        />
        <Route path="*" element={<Navigate to="/browse" replace />} />
      </Routes>
    );
  }

  // LOGGED IN - FORCE PROFILE COMPLETION FOR NORMAL USERS
  if (userRole === "user" && !userDoc?.profileComplete) {
    return (
      <>
        <Header
          user={user}
          userRole={userRole}
          userDoc={userDoc}
          onLogout={handleLogout}
          onBrowseCaregivers={handleBrowseCaregivers}
          notificationCount={notificationCount}
        />
        <Routes>
          <Route path="/user/profile" element={<UserProfilePage />} />
          <Route path="*" element={<Navigate to="/user/profile" replace />} />
        </Routes>
      </>
    );
  }

  // LOGGED IN - FORCE PROFILE COMPLETION FOR ORGANIZATIONS
  if (userRole === "orgadmin" && !userDoc?.profileComplete) {
    return (
      <>
        <Header
          user={user}
          userRole={userRole}
          userDoc={userDoc}
          onLogout={handleLogout}
          onBrowseCaregivers={handleBrowseCaregivers}
          notificationCount={notificationCount}
        />
        <Routes>
          <Route path="/organization/profile" element={<OrganizationProfilePage />} />
          <Route path="*" element={<Navigate to="/organization/profile" replace />} />
        </Routes>
      </>
    );
  }

  // LOGGED IN - ROUTES BY ROLE
  return (
    <>
      <Header
        user={user}
        userRole={userRole}
        userDoc={userDoc}
        onLogout={handleLogout}
        onBrowseCaregivers={handleBrowseCaregivers}
        onMyBookings={handleMyBookings}
        notificationCount={notificationCount}
      />
      <Routes>
        {/* USER ROUTES */}
        {userRole === "user" && (
          <>
            <Route path="/user/profile" element={<UserProfilePage />} />
            <Route
              path="/user/mybookings"
              element={
                <div className="app-shell app-shell--compact">
                  <div className="app-card app-card--compact">
                    <MyBookingsPage />
                  </div>
                </div>
              }
            />
            <Route
              path="/user/*"
              element={
                selectedCaregiver ? (
                  <div className="app-shell">
                    <div className="app-card">
                      <div className="app-header">
                        <div>
                          <h1 className="app-title">Sewak – Booking</h1>
                          <p className="app-subtitle">
                            Confirm service details
                          </p>
                        </div>
                        <div className="app-header-actions">
                          <button
                            className="btn btn-outline"
                            onClick={() => setSelectedCaregiver(null)}
                          >
                            Back
                          </button>
                        </div>
                      </div>
                      <BookingFormPage
                        caregiver={selectedCaregiver}
                        onBooked={() => {
                          setSelectedCaregiver(null);
                          navigate("/user/mybookings");
                        }}
                      />
                    </div>
                  </div>
                ) : showMyBookings ? (
                  <div className="app-shell">
                    <div className="app-card">
                      <div className="app-header">
                        <div>
                          <h1 className="app-title">My Bookings</h1>
                        </div>
                        <div className="app-header-actions">
                          <button
                            className="btn btn-outline"
                            onClick={() => navigate("/user")}
                          >
                            Browse Caregivers
                          </button>
                        </div>
                      </div>
                      <MyBookingsPage />
                    </div>
                  </div>
                ) : (
                  <div className="app-shell">
                    <div className="app-card">
                      <div className="choice-group">
                        <h3>What do you need help with?</h3>
                        <div className="choice-buttons">
                          <button
                            type="button"
                            className={`choice-btn ${
                              userCategory === "both" ? "active" : ""
                            }`}
                            onClick={() => setUserCategory("both")}
                          >
                            👥 Both
                          </button>
                          <button
                            type="button"
                            className={`choice-btn ${
                              userCategory === "caregiver" ? "active" : ""
                            }`}
                            onClick={() => setUserCategory("caregiver")}
                          >
                            🏥 Care Giver
                          </button>
                          <button
                            type="button"
                            className={`choice-btn ${
                              userCategory === "household" ? "active" : ""
                            }`}
                            onClick={() => setUserCategory("household")}
                          >
                            🏠 Household
                          </button>
                        </div>
                      </div>

                      <div className="choice-group">
                        <h4>Work type</h4>
                        <div className="choice-buttons">
                          <button
                            type="button"
                            className={`choice-btn ${
                              userWorkType === "fulltime" ? "active" : ""
                            }`}
                            onClick={() => {
                              setUserWorkType("fulltime");
                              setUserShift("");
                            }}
                          >
                            💼 Full time
                          </button>
                          <button
                            type="button"
                            className={`choice-btn ${
                              userWorkType === "parttime" ? "active" : ""
                            }`}
                            onClick={() => setUserWorkType("parttime")}
                          >
                            ⏰ Part time
                          </button>
                        </div>
                      </div>

                      {userWorkType === "parttime" && (
                        <div className="choice-group">
                          <h4>Preferred shift</h4>
                          <div className="choice-buttons">
                            {["morning", "day", "night"].map((s) => (
                              <button
                                key={s}
                                type="button"
                                className={`choice-btn ${
                                  userShift === s ? "active" : ""
                                }`}
                                onClick={() => setUserShift(s)}
                              >
                                {s === "morning"
                                  ? "🌅 Morning"
                                  : s === "day"
                                    ? "☀️ Day"
                                    : "🌙 Night"}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <CaregiverListPage
                        onSelectCaregiver={setSelectedCaregiver}
                        preselectedWorkType={userWorkType}
                        preselectedShift={userShift}
                        userCategory={userCategory}
                        onChangeUserCategory={setUserCategory}
                        onChangeWorkType={setUserWorkType}
                        onChangeShift={setUserShift}
                        requireLogin={false}
                      />
                    </div>
                  </div>
                )
              }
            />
          </>
        )}

        {/* ORGANIZATION ADMIN ROUTES */}
        {userRole === "orgadmin" && (
          <>
            <Route path="/organization/profile" element={<OrganizationProfilePage />} />
            <Route
              path="/organization/*"
              element={
                <div className="app-shell">
                  <div className="app-card">
                    <OrganizationDashboard />
                  </div>
                </div>
              }
            />
          </>
        )}

        {/* CAREGIVER ROUTES */}
        {userRole === "caregiver" && (
          <Route
            path="/caregiver/*"
            element={
              <div className="app-shell">
                <div className="app-card">
                  <CaregiverDashboardPage />
                </div>
              </div>
            }
          />
        )}

        {/* SUPERADMIN ROUTES */}
        {userRole === "superadmin" && (
          <Route
            path="/superadmin/*"
            element={
              <div className="app-shell">
                <div className="app-card">
                  <AdminDashboardPage />
                </div>
              </div>
            }
          />
        )}

        {/* Report user page */}
        <Route
          path="/caregiver/reportuser"
          element={<CaregiverReportUserPage />}
        />

        {/* Fallback redirects */}
        <Route
          path="*"
          element={
            userRole === "superadmin" ? (
              <Navigate to="/superadmin" replace />
            ) : userRole === "orgadmin" ? (
              <Navigate to="/organization" replace />
            ) : userRole === "caregiver" ? (
              <Navigate to="/caregiver" replace />
            ) : userRole === "user" ? (
              userDoc?.profileComplete ? (
                <Navigate to="/user" replace />
              ) : (
                <Navigate to="/user/profile" replace />
              )
            ) : (
              <Navigate to="/browse" replace />
            )
          }
        />
      </Routes>
    </>
  );
}

export default App;
