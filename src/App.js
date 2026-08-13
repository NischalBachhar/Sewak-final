import React, { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useAuth } from "./AuthContext";
import AuthPage from "./AuthPage";
import UserProfilePage from "./UserProfilePage";
import OrganizationProfilePage from "./OrganizationProfilePage";
import CaregiverDashboardPage from "./CaregiverDashboardPage";
import CaregiverListPage from "./CaregiverListPage";
import BookingRequestPage from "./BookingRequestPage";
import BookingDetailPage from "./BookingDetailPage";
import PublicCaregiverProfilePage from "./PublicCaregiverProfilePage";
import PaymentCallbackPage from "./PaymentCallbackPage";
import MyBookingsPage from "./MyBookingsPage";
import CustomerHomePage from "./CustomerHomePage";
import AdminDashboardPage from "./AdminDashboardPage";
import OrganizationDashboard from "./OrganizationDashboard";
import CaregiverReportUserPage from "./CaregiverReportUserPage";
import BrowsePage from "./BrowsePage";
import Header from "./components/Header";
import MobileBottomNavigation from "./components/MobileBottomNavigation";
import { SkeletonCard } from "./components/CareExperience";
import { auth, db } from "./firebaseConfig";
import "./App.css";

function App() {
  const { user, loading, userRole, userDoc } = useAuth();
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
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  const handleBrowseCaregivers = () => {
    navigate("/user");
  };

  const handleMyBookings = () => {
    const currentCompletedIds = bookingsSnapshotRef.current
      .filter((booking) => booking.status === "completed")
      .map((booking) => booking.id);

    if (user?.uid) {
      const storageKey = `seenCompletedBookings_${user.uid}`;
      const stored = localStorage.getItem(storageKey);
      const storedIds = parseSavedIds(stored);
      const mergedIds = Array.from(
        new Set([...(storedIds || []), ...currentCompletedIds])
      );
      localStorage.setItem(storageKey, JSON.stringify(mergedIds));
      seenCompletedIdsRef.current = mergedIds;
    }

    setNotificationCount(0);
    navigate("/user/mybookings");
  };

  useEffect(() => {
    if (!user || userRole !== "user") return undefined;

    const storageKey = `seenCompletedBookings_${user.uid}`;
    const stored = localStorage.getItem(storageKey);
    seenCompletedIdsRef.current = parseSavedIds(stored);

    const bookingsQuery = query(
      collection(db, "bookings"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const bookings = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }));
      const currentCompletedIds = bookings
        .filter((booking) => booking.status === "completed")
        .map((booking) => booking.id);
      const unseenCompleted = currentCompletedIds.filter(
        (id) => !seenCompletedIdsRef.current.includes(id)
      );

      if (!bookingsInitialLoadRef.current) {
        setNotificationCount(unseenCompleted.length);
      } else if (stored) {
        setNotificationCount(unseenCompleted.length);
      } else {
        setNotificationCount(0);
        seenCompletedIdsRef.current = currentCompletedIds;
        localStorage.setItem(storageKey, JSON.stringify(currentCompletedIds));
      }

      bookingsSnapshotRef.current = bookings;
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
      if (userDoc?.profileComplete && path === "/organization/profile") {
        navigate("/organization/dashboard", { replace: true });
      } else if (!userDoc?.profileComplete && path === "/organization/dashboard") {
        navigate("/organization/profile", { replace: true });
      } else if (path === "/" || path === "/browse" || path === "/auth") {
        navigate(
          userDoc?.profileComplete
            ? "/organization/dashboard"
            : "/organization/profile",
          { replace: true }
        );
      }
    } else if (userRole === "user") {
      if (!userDoc?.profileComplete && (path === "/user" || path === "/user/")) {
        navigate("/user/profile", { replace: true });
      } else if (path === "/" || path === "/browse" || path === "/auth") {
        navigate(
          userDoc?.profileComplete ? "/user" : "/user/profile",
          { replace: true },
        );
      }
    }
  }, [user, userRole, userDoc?.profileComplete, navigate]);

  useEffect(() => {
    if (!user || userRole !== "user" || !userDoc?.profileComplete) return;

    try {
      const caregiverId = localStorage.getItem("pendingBookingCaregiverId");
      const savedCaregiver = localStorage.getItem("pendingBookingCaregiver");
      localStorage.removeItem("pendingBookingCaregiverId");
      localStorage.removeItem("pendingBookingCaregiver");

      if (caregiverId) {
        navigate(`/user/book/${caregiverId}`, { replace: true });
      } else if (savedCaregiver) {
        const caregiver = JSON.parse(savedCaregiver);
        if (caregiver?.id) {
          navigate(`/user/book/${caregiver.id}`, { replace: true });
        }
      }
    } catch {
      localStorage.removeItem("pendingBookingCaregiver");
      localStorage.removeItem("pendingBookingCaregiverId");
    }
  }, [user, userRole, userDoc?.profileComplete, navigate]);

  if (loading) {
    return (
      <main
        className="app-shell"
        aria-label="Loading Sewak"
        style={{ alignItems: "stretch", padding: "20px" }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 1040,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {[0, 1, 2].map((index) => (
            <SkeletonCard
              key={index}
              variant="dashboard"
              label="Loading your Sewak dashboard"
            />
          ))}
        </div>
      </main>
    );
  }

  if (user && !userRole) {
    return (
      <main
        className="app-shell"
        aria-label="Loading your dashboard"
        style={{ alignItems: "stretch", padding: "20px" }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 720,
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {[0, 1].map((index) => (
            <SkeletonCard
              key={index}
              variant="dashboard"
              label="Loading your dashboard"
            />
          ))}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/browse" element={<BrowsePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route
          path="/caregivers/:caregiverId"
          element={<PublicCaregiverProfilePage />}
        />
        <Route path="/payment-callback" element={<PaymentCallbackPage />} />
        <Route path="*" element={<Navigate to="/browse" replace />} />
      </Routes>
    );
  }

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
          <Route
            path="/organization/profile"
            element={<OrganizationProfilePage />}
          />
          <Route
            path="*"
            element={<Navigate to="/organization/profile" replace />}
          />
        </Routes>
      </>
    );
  }

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
        <Route path="/payment-callback" element={<PaymentCallbackPage />} />
        <Route
          path="/caregivers/:caregiverId"
          element={<PublicCaregiverProfilePage signedIn />}
        />

        {userRole === "user" && (
          <>
            <Route
              path="/user/home"
              element={
                <div className="app-shell app-shell--compact">
                  <div className="app-card app-card--compact">
                    <CustomerHomePage />
                  </div>
                </div>
              }
            />
            <Route path="/user/profile" element={<UserProfilePage />} />
            <Route
              path="/user/caregivers/:caregiverId"
              element={<PublicCaregiverProfilePage signedIn />}
            />
            <Route
              path="/user/book/:caregiverId"
              element={<BookingRequestPage />}
            />
            <Route
              path="/user/bookings/:bookingId"
              element={<BookingDetailPage />}
            />
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
                <div className="app-shell">
                  <div className="app-card">
                    <CaregiverListPage
                      variant="browse"
                      onSelectCaregiver={(caregiver) =>
                        navigate(`/user/book/${caregiver.id}`)
                      }
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
              }
            />
          </>
        )}

        {userRole === "orgadmin" && (
          <>
            <Route
              path="/organization/profile"
              element={<OrganizationProfilePage />}
            />
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

        {userRole === "caregiver" && (
          <>
            <Route
              path="/caregiver/reportuser"
              element={<CaregiverReportUserPage />}
            />
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
          </>
        )}

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
      <MobileBottomNavigation role={userRole} />
    </>
  );
}

export default App;
