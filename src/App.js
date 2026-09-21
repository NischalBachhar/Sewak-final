import React, { lazy, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import useCustomerBookings from "./useCustomerBookings";
import NotFound from "./components/NotFound";
import { useAuth } from "./AuthContext";
import AuthPage from "./AuthPage";
import CaregiverListPage from "./CaregiverListPage";
import PublicCaregiverProfilePage from "./PublicCaregiverProfilePage";
import BrowsePage from "./BrowsePage";
import Header from "./components/Header";
import MobileBottomNavigation from "./components/MobileBottomNavigation";
import { ErrorState, SkeletonCard } from "./components/CareExperience";
import { auth } from "./firebaseConfig";
import "./App.css";
import "./DashboardExperience.css";

const UserProfilePage = lazy(() => import("./UserProfilePage"));
const OrganizationProfilePage = lazy(() => import("./OrganizationProfilePage"));
const CaregiverDashboardPage = lazy(() => import("./CaregiverDashboardPage"));
const BookingRequestPage = lazy(() => import("./BookingRequestPage"));
const BookingDetailPage = lazy(() => import("./BookingDetailPage"));
const PaymentCallbackPage = lazy(() => import("./PaymentCallbackPage"));
const MyBookingsPage = lazy(() => import("./MyBookingsPage"));
const CustomerHomePage = lazy(() => import("./CustomerHomePage"));
const AdminDashboardPage = lazy(() => import("./AdminDashboardPage"));
const OrganizationDashboard = lazy(() => import("./OrganizationDashboard"));
const CaregiverReportUserPage = lazy(() => import("./CaregiverReportUserPage"));

function DashboardPath({ root, sections, children }) {
  const { pathname } = useLocation();
  const suffix = pathname.replace(/\/$/, "").slice(root.length);
  return suffix === "" || sections.some((section) => suffix === `/${section}`) ? children : <NotFound />;
}

function App() {
  const { user, loading, userRole, userDoc, accountError, registrationPending } = useAuth();
  const [userCategory, setUserCategory] = useState("");
  const [userWorkType, setUserWorkType] = useState("");
  const [userShift, setUserShift] = useState("");
  const customerBookings = useCustomerBookings(userRole === "user" ? user?.uid : null);
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
      console.error("Logout error:", { code: err?.code || "unknown" });
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

    if (customerBookings.loading || customerBookings.error) return undefined;
    const bookings = customerBookings.bookings;
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
  }, [user, userRole, customerBookings]);

  useEffect(() => {
    setNotificationCount(0); bookingsSnapshotRef.current = []; bookingsInitialLoadRef.current = true; seenCompletedIdsRef.current = [];
  }, [user?.uid]);

  useEffect(() => {
    if (!user || !userRole || registrationPending) return;

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
  }, [user, userRole, userDoc?.profileComplete, navigate, registrationPending]);

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

  if (registrationPending || userDoc?.registrationIncomplete || (!user && window.location.pathname === "/auth")) return <AuthPage />;

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

  if (user && accountError) {
    return (
      <main
        className="app-shell"
        aria-label="Account access needs attention"
        style={{ alignItems: "stretch", padding: "20px" }}
      >
        <div
          className="app-card"
          style={{ maxWidth: 640, margin: "0 auto" }}
        >
          <ErrorState
            title="We couldn't open your account"
            description={accountError}
            retryLabel="Refresh access"
            onRetry={() => window.location.reload()}
          />
          <button
            type="button"
            className="btn btn-outline"
            style={{ marginTop: 16 }}
            onClick={handleLogout}
          >
            Sign out
          </button>
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
        <Route path="/" element={<Navigate to="/browse" replace />} />
        {["/user/*", "/caregiver/*", "/organization/*", "/superadmin/*"].map((path) => <Route key={path} path={path} element={<Navigate to="/auth" replace />} />)}
        <Route path="*" element={<NotFound />} />
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
                <div className="app-shell app-shell--compact dashboard-shell dashboard-shell--customer">
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
                <div className="app-shell app-shell--compact dashboard-shell dashboard-shell--customer">
                  <div className="app-card app-card--compact">
                    <MyBookingsPage />
                  </div>
                </div>
              }
            />
            <Route
              path="/user"
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
                <div className="app-shell dashboard-shell dashboard-shell--organization">
                  <div className="app-card">
                    <DashboardPath root="/organization" sections={["dashboard"]}><OrganizationDashboard /></DashboardPath>
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
                <div className="app-shell dashboard-shell dashboard-shell--caregiver">
                  <div className="app-card">
                    <DashboardPath root="/caregiver" sections={["dashboard", "home", "jobs", "schedule", "profile", "earnings"]}><CaregiverDashboardPage /></DashboardPath>
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
              <div className="app-shell dashboard-shell dashboard-shell--admin">
                <div className="app-card">
                  <DashboardPath root="/superadmin" sections={["overview", "organizations", "caregivers", "bookings", "services", "blacklist", "admins", "analytics"]}><AdminDashboardPage /></DashboardPath>
                </div>
              </div>
            }
          />
        )}

        <Route
          path="/"
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
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <MobileBottomNavigation role={userRole} />
    </>
  );
}

export default App;
