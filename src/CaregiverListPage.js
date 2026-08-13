import React, { useEffect, useRef, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "./firebaseConfig";
import { hasVerifiedRating } from "./bookingModel";
import { formatNpr } from "./config/brand";
import { SkeletonCard, VerificationBadge } from "./components/CareExperience";

const SHIFTS = ["morning", "day", "night"];

// Helper – extract readable service name from vendors data
const getServiceNameFromVendorData = (serviceString) => {
  if (!serviceString) return "";
  const parts = serviceString.split(" ");
  if (parts.length >= 2) {
    return parts
      .slice(1)
      .join(" ")
      .replace(/_/g, " ")
      .split(" ")
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(" ");
  }
  return serviceString;
};

// Normalize servicesOffered entries (your vendors store IDs or labels)
const normalizeServiceId = (s) =>
  (s || "")
    .trim()
    .toLowerCase();

function BrowseCaregiverCard({ caregiver, services, onSelect, onViewProfile, requireLogin }) {
  const getInitials = (name) =>
    (name || "C")
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase();

  const getServiceLabel = (serviceId) => {
    if (!serviceId) return "";
    const normalizedId = normalizeServiceId(serviceId);
    const match = (services || []).find(
      (service) =>
        normalizeServiceId(service.id) === normalizedId ||
        normalizeServiceId(service.label) === normalizedId ||
        normalizeServiceId(service.serviceName) === normalizedId,
    );
    return match?.label || match?.serviceName || getServiceNameFromVendorData(serviceId);
  };

  const serviceLabels = (caregiver.servicesOffered || [])
    .map((service) => getServiceLabel(service))
    .filter(Boolean);
  const rating = hasVerifiedRating(caregiver) ? Number(caregiver.rating) : null;
  const schedule =
    caregiver.workType === "fulltime"
      ? "Full time"
      : caregiver.workType === "parttime"
        ? "Part time"
        : "—";

  const handleBookClick = () => {
    if (requireLogin) {
      localStorage.setItem("pendingBookingCaregiverId", caregiver.id);
      window.location.href = "/auth";
      return;
    }

    onSelect && onSelect(caregiver);
  };

  return (
    <article className="browse-caregiver-card">
      <div className="browse-caregiver-card__top">
        <div className="browse-caregiver-card__avatar">
          {caregiver.profileImage ? (
            <img src={caregiver.profileImage} alt={caregiver.name || "Caregiver"} />
          ) : (
            getInitials(caregiver.name)
          )}
        </div>
        <div className="browse-caregiver-card__identity">
          <div className="browse-caregiver-card__name-row">
            <h3 title={caregiver.name || "Caregiver"}>{caregiver.name || "Caregiver"}</h3>
            {caregiver.verified ? (
              <VerificationBadge
                state="verified"
                label="Verified"
                description="Verified by Sewak based on the approved records shown in this profile."
                compact
              />
            ) : null}
          </div>
          <p className="browse-caregiver-card__location">
            {caregiver.location || "Location not listed"}
          </p>
          {caregiver.organizationName && (
            <p className="browse-caregiver-card__organization">
              {caregiver.organizationName}
            </p>
          )}
          {rating !== null && (
            <div className="browse-rating" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
              <span className="browse-rating__star" aria-hidden="true">★</span>
              <span>{rating.toFixed(1)}</span>
              <span className="browse-rating__count">({caregiver.reviewCount || 0} reviews)</span>
            </div>
          )}
        </div>
      </div>

      <div className="browse-caregiver-card__tags" aria-label="Services offered">
        {serviceLabels.length > 0 ? (
          <>
            {serviceLabels.slice(0, 2).map((service) => (
              <span className="browse-service-tag" key={service}>{service}</span>
            ))}
            {serviceLabels.length > 2 && (
              <span className="browse-service-more">+{serviceLabels.length - 2} more</span>
            )}
          </>
        ) : (
          <span className="browse-service-tag">Services on request</span>
        )}
      </div>

      <div className="browse-assurance-row" aria-label="Profile checks">
        {caregiver.backgroundChecked && <span className="browse-assurance-tag">Background checked</span>}
        {caregiver.verified && <span className="browse-assurance-tag">ID verified</span>}
        {caregiver.isCertified && <span className="browse-assurance-tag browse-assurance-tag--certified">Certified</span>}
      </div>

      <dl className="browse-caregiver-card__stats">
        <div>
          <dt>Years experience</dt>
          <dd>{caregiver.experience ? `${caregiver.experience}+` : "—"}</dd>
        </div>
        <div>
          <dt>Jobs completed</dt>
          <dd>{typeof caregiver.jobsCompleted === "number" ? caregiver.jobsCompleted : "—"}</dd>
        </div>
        <div>
          <dt>Schedule</dt>
          <dd>{schedule}</dd>
        </div>
      </dl>

      <div className="browse-caregiver-card__footer">
        <div className={`browse-price${caregiver.hourlyRate ? "" : " browse-price--unlisted"}`}>
          <small>{caregiver.hourlyRate ? "Starting at" : "Rate"}</small>
          <strong>{caregiver.hourlyRate ? `${formatNpr(caregiver.hourlyRate)}/hour` : "On request"}</strong>
        </div>
        <div className="browse-card-actions">
          <button
            type="button"
            className="browse-card-action browse-card-action--secondary"
            onClick={() => onViewProfile?.(caregiver)}
          >
            View profile
          </button>
          <button
          type="button"
          className="browse-card-action"
          onClick={handleBookClick}
          disabled={caregiver.isSuspended || !caregiver.isApproved}
        >
          {requireLogin ? "Sign in to book" : "Book now"}
          <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function CaregiverCard({ caregiver, services, onSelect, onViewProfile, requireLogin, hasPaid }) {
  const getInitials = (name) =>
    (name || "C")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();

  const getServiceLabel = (serviceId) => {
    if (!serviceId) return "";
    const normalizedId = normalizeServiceId(serviceId);
    const match = (services || []).find(
      (s) =>
        normalizeServiceId(s.id) === normalizedId ||
        normalizeServiceId(s.label) === normalizedId ||
        normalizeServiceId(s.serviceName) === normalizedId,
    );
    return match?.label || match?.serviceName || getServiceNameFromVendorData(serviceId);
  };

  const getRatingStars = (rating) => {
    const stars = Math.round(rating || 0);
    return "★".repeat(stars) + "☆".repeat(5 - stars);
  };

  const handleBookClick = () => {
    if (requireLogin) {
      localStorage.setItem(
        "pendingBookingCaregiver",
        JSON.stringify(caregiver),
      );
      window.location.href = "/auth";
    } else {
      onSelect && onSelect(caregiver);
    }
  };

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        {caregiver.profileImage ? (
          <img
            src={caregiver.profileImage}
            alt={caregiver.name || "Caregiver"}
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "var(--theme-help)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 24,
              fontWeight: "bold",
            }}
          >
            {getInitials(caregiver.name)}
          </div>
        )}

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <strong style={{ fontSize: 16, color: "var(--theme-help)" }}>
                {caregiver.name || "Caregiver"}
              </strong>
              {caregiver.verified && (
                <span
                  style={{
                    marginLeft: 8,
                    background: "var(--theme-positive-soft)",
                    color: "var(--theme-positive)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    fontSize: 11,
                    fontWeight: "600",
                  }}
                >
                  ✓ Verified
                </span>
              )}
            </div>
          </div>

          <p style={{ margin: "4px 0", fontSize: 12, color: "var(--theme-help)" }}>
            📍 {caregiver.location || "Location not specified"}
          </p>

          {caregiver.organizationName && (
            <p
              style={{
                margin: "4px 0",
                fontSize: 12,
                color: "var(--theme-help)",
                fontWeight: "500",
              }}
            >
              🏢 {caregiver.organizationName}
            </p>
          )}

          {hasVerifiedRating(caregiver) && (
            <div style={{ marginTop: 4 }}>
              <span style={{ color: "var(--theme-warning)", fontSize: 13 }}>
                {getRatingStars(caregiver.rating)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: "var(--theme-text-muted)",
                  marginLeft: 8,
                }}
              >
                {caregiver.rating.toFixed(1)} ({caregiver.reviewCount || 0}{" "}
                reviews)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Category, work type, services, shifts */}
      <div
        style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: "1px solid var(--theme-text)",
        }}
      >
        <p style={{ fontSize: 13, color: "var(--theme-help)", marginBottom: 6 }}>
          <span style={{ color: "var(--theme-help)" }}>Category:</span>{" "}
          {caregiver.category === "caregiver"
            ? "🏥 Care giver"
            : caregiver.category === "household"
            ? "🏠 Household"
            : "👥 Both"}
        </p>

        <p style={{ fontSize: 13, color: "var(--theme-help)", marginBottom: 6 }}>
          <span style={{ color: "var(--theme-help)" }}>Work type:</span>{" "}
          {caregiver.workType === "fulltime"
            ? "💼 Full time"
            : caregiver.workType === "parttime"
            ? "⏰ Part time"
            : "Not specified"}
        </p>

        <p style={{ fontSize: 13, color: "var(--theme-help)", marginBottom: 6 }}>
          <span style={{ color: "var(--theme-help)" }}>Services:</span>{" "}
          {(caregiver.servicesOffered || []).length > 0
            ? (caregiver.servicesOffered || [])
                .map((service) => getServiceLabel(service))
                .join(", ")
            : "Not specified"}
        </p>

        <p style={{ fontSize: 13, color: "var(--theme-help)" }}>
          <span style={{ color: "var(--theme-help)" }}>Shifts:</span>{" "}
          {(caregiver.shifts || [])
            .map((s) => s[0].toUpperCase() + s.slice(1))
            .join(", ") || "Not specified"}
        </p>
      </div>

      {/* Stats */}
      <div className="stat-row">
        <div className="stat-card stat-card--help">
          <div className="stat-value">{caregiver.experience || 0}+</div>
          <div className="stat-label">Years exp</div>
        </div>
        <div className="stat-card stat-card--help">
          <div className="stat-value">{caregiver.jobsCompleted || 0}+</div>
          <div className="stat-label">Jobs done</div>
        </div>
        <div className="stat-card stat-card--help">
          <div className="stat-value">
            {typeof caregiver.satisfactionRate === "number"
              ? `${caregiver.satisfactionRate}%`
              : "—"}
          </div>
          <div className="stat-label">Satisfaction</div>
        </div>
      </div>

      {/* Verification badges */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          margin: "12px 0",
        }}
      >
        {caregiver.backgroundChecked && (
          <span
            style={{
              background: "var(--theme-help-soft)",
              color: "var(--theme-help)",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            ✓ Background checked
          </span>
        )}
        {caregiver.verified && (
          <span
            style={{
              background: "var(--theme-help-soft)",
              color: "var(--theme-help)",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            ✓ ID verified
          </span>
        )}
        {caregiver.isCertified && (
          <span
            style={{
              background: "var(--theme-warning-soft)",
              color: "var(--theme-warning)",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: 11,
              fontWeight: "600",
            }}
          >
            🏆 Certified
          </span>
        )}
      </div>

      {/* Pricing */}
      {caregiver.hourlyRate && (
        <div className="price-chip">
          💰 {formatNpr(caregiver.hourlyRate)}/hour
        </div>
      )}

      {/* Actions */}
      <div className="action-row">
        <button
          className="btn btn-outline btn-full"
          type="button"
          onClick={() => onViewProfile?.(caregiver)}
        >
          View Profile
        </button>
        <button
          className="btn btn-primary btn-full"
          onClick={handleBookClick}
          disabled={caregiver.isSuspended || !caregiver.isApproved}
        >
          📅 {requireLogin ? "Sign in to book" : "Book now"}
        </button>

        {hasPaid && caregiver.phone && (
          <a
            href={`https://wa.me/${caregiver.phone.replace(/\D/g, "")}`}
            className="btn btn-whatsapp btn-full"
            target="_blank"
            rel="noopener noreferrer"
          >
            💬 WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

export default function CaregiverListPage({
  onSelectCaregiver,
  preselectedWorkType = "",
  preselectedShift = "",
  userCategory = "",
  onChangeUserCategory,
  onChangeWorkType,
  onChangeShift,
  requireLogin = false,
  hasPaid = false,
  variant = "default",
}) {
  const navigate = useNavigate();
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [workTypeFilter, setWorkTypeFilter] = useState(preselectedWorkType || "");
  const [shiftFilter, setShiftFilter] = useState(preselectedShift || "");
  const [locationFilter, setLocationFilter] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [minimumExperience, setMinimumExperience] = useState("");
  const [minimumRating, setMinimumRating] = useState("");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [services, setServices] = useState([]);
  const filterToggleRef = useRef(null);
  const filterSheetRef = useRef(null);
  const isBrowse = variant === "browse";

  useEffect(() => {
    setWorkTypeFilter(preselectedWorkType || "");
  }, [preselectedWorkType]);

  useEffect(() => {
    setShiftFilter(preselectedShift || "");
  }, [preselectedShift]);

  useEffect(() => {
    if (!filterSheetOpen) return undefined;

    const previousFocusedElement = document.activeElement;
    const filterTrigger = filterToggleRef.current;
    const focusableSelector = [
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "a[href]",
    ].join(",");
    const focusDialog = () => {
      const firstFocusable = filterSheetRef.current?.querySelector(focusableSelector);
      (firstFocusable || filterSheetRef.current)?.focus();
    };
    const focusTimer = window.setTimeout(focusDialog, 0);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setFilterSheetOpen(false);
        return;
      }

      if (event.key !== "Tab" || !filterSheetRef.current) return;
      const focusable = Array.from(
        filterSheetRef.current.querySelectorAll(focusableSelector),
      );
      if (!focusable.length) {
        event.preventDefault();
        filterSheetRef.current.focus();
        return;
      }

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      const containsFocus = filterSheetRef.current.contains(document.activeElement);
      if (event.shiftKey && (!containsFocus || document.activeElement === firstFocusable)) {
        event.preventDefault();
        lastFocusable.focus();
      } else if (!event.shiftKey && (!containsFocus || document.activeElement === lastFocusable)) {
        event.preventDefault();
        firstFocusable.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      const focusTarget =
        previousFocusedElement && typeof previousFocusedElement.focus === "function"
          ? previousFocusedElement
          : filterTrigger;
      focusTarget?.focus?.();
    };
  }, [filterSheetOpen]);

  // Load caregivers (approved + not suspended)
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const q = query(
          collection(db, "publicCaregivers"),
          where("isApproved", "==", true),
          where("isSuspended", "==", false),
          where("isBlacklisted", "==", false),
          where("isOrganizationActive", "==", true),
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setCaregivers(docs);
      } catch (err) {
        console.error("Error loading caregivers:", err);
        setError(
          err?.code === "permission-denied"
            ? "Caregiver profiles are temporarily unavailable while access is being updated. Please try again shortly."
            : "We couldn't load caregiver profiles just now. Please try again shortly.",
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [reloadKey]);

  // Load services (used for dropdown)
  useEffect(() => {
    const loadServices = async () => {
      try {
        const snap = await getDocs(collection(db, "publicServices"));
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setServices(list);
      } catch (err) {
        console.error("Error loading services:", err);
      }
    };
    loadServices();
  }, []);

  // Service dropdown options depend on userCategory
  const visibleServices = services.filter((s) => {
    if (!userCategory || userCategory === "both") return true;
    if (s.category === "both") return true;
    return s.category === userCategory;
  });

  // Apply all filters
  const filtered = caregivers.filter((c) => {
    // Category filter: “both” should show everyone
    if (userCategory === "caregiver" && !["caregiver", "both"].includes(c.category)) return false;
    if (userCategory === "household" && !["household", "both"].includes(c.category)) return false;
    // if userCategory is "both" or "", we do not restrict c.category

    // Search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (
        !(c.name || "").toLowerCase().includes(search) &&
        !(c.location || "").toLowerCase().includes(search)
      ) {
        return false;
      }
    }

    // Availability
    if (c.isAvailable === false) return false;

    // Service filter: compare normalized IDs
    if (serviceFilter) {
      const offered = (c.servicesOffered || []).map(normalizeServiceId);
      if (!offered.includes(normalizeServiceId(serviceFilter))) return false;
    }

    // Work type filter – your vendors store "fulltime" / "parttime"
    if (workTypeFilter && c.workType !== workTypeFilter) return false;

    // Shift filter
    if (shiftFilter && !(c.shifts || []).includes(shiftFilter)) return false;

    // Location filter
    if (
      locationFilter &&
      !(c.location || "").toLowerCase().includes(locationFilter.toLowerCase())
    )
      return false;

    if (verifiedOnly && !c.verified) return false;

    if (minimumExperience && Number(c.experience || 0) < Number(minimumExperience)) return false;

    if (minimumRating && (!hasVerifiedRating(c) || Number(c.rating) < Number(minimumRating))) return false;

    return true;
  });

  const featured = filtered.filter((c) => hasVerifiedRating(c) && Number(c.rating) >= 4.5);
  const regular = filtered.filter((c) => !featured.includes(c));

  if (loading) {
    if (isBrowse) {
      return (
        <section
          className="browse-list"
          aria-busy="true"
          aria-label="Loading caregiver profiles"
        >
          <div className="browse-caregiver-grid">
            {[0, 1, 2, 3].map((index) => (
              <SkeletonCard
                key={index}
                variant="caregiver"
                label="Loading caregiver profile"
              />
            ))}
          </div>
        </section>
      );
    }

    return (
      <div aria-busy="true" aria-label="Loading caregiver profiles">
        <SkeletonCard variant="caregiver" label="Loading caregiver profile" />
      </div>
    );
  }

  if (error) {
    if (isBrowse) {
      return (
        <section className="browse-list" aria-live="polite">
          <div className="browse-load-state">
            <div className="browse-empty-state__icon" aria-hidden="true">!</div>
            <h3>We couldn&apos;t load caregivers</h3>
            <p>{error}</p>
            <button
              type="button"
              className="browse-retry-button"
              onClick={() => setReloadKey((current) => current + 1)}
            >
              Try again
            </button>
          </div>
        </section>
      );
    }

    return <p className="error-message">{error}</p>;
  }

  if (isBrowse) {
    const selectedService = services.find(
      (service) => normalizeServiceId(service.id) === normalizeServiceId(serviceFilter),
    );
    const activeFilters = [
      searchTerm && `Search: ${searchTerm}`,
      userCategory === "caregiver" && "Caregiver support",
      userCategory === "household" && "Household help",
      userCategory === "both" && "Care + household",
      selectedService && `Service: ${selectedService.label || selectedService.serviceName}`,
      workTypeFilter === "fulltime" && "Full time",
      workTypeFilter === "parttime" && "Part time",
      shiftFilter && `${shiftFilter[0].toUpperCase()}${shiftFilter.slice(1)} shift`,
      locationFilter && `Near ${locationFilter}`,
      verifiedOnly && "Verified only",
      minimumExperience && `${minimumExperience}+ years experience`,
      minimumRating && `${minimumRating}+ verified rating`,
    ].filter(Boolean);

    const clearFilters = () => {
      setSearchTerm("");
      setServiceFilter("");
      setWorkTypeFilter("");
      setShiftFilter("");
      setLocationFilter("");
      setVerifiedOnly(false);
      setMinimumExperience("");
      setMinimumRating("");
      onChangeUserCategory && onChangeUserCategory("");
      onChangeWorkType && onChangeWorkType("");
      onChangeShift && onChangeShift("");
    };

    const handleBrowseWorkTypeChange = (value) => {
      setWorkTypeFilter(value);
      onChangeWorkType && onChangeWorkType(value);
      if (value !== "parttime") {
        setShiftFilter("");
        onChangeShift && onChangeShift("");
      }
    };

    return (
      <section className="browse-list">
        <div className="browse-list__heading">
          <div>
            <p className="browse-list__eyebrow">Browse local profiles</p>
            <div className="browse-list__title-row">
              <h2>Caregivers ready to help</h2>
              <span className="browse-result-count">
                {filtered.length} {filtered.length === 1 ? "match" : "matches"}
              </span>
            </div>
          </div>
          <p>Use the filters to find a person whose skills, schedule, and location work for you.</p>
        </div>

        <button
          type="button"
          ref={filterToggleRef}
          className="browse-mobile-filter-toggle"
          onClick={() => setFilterSheetOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={filterSheetOpen}
        >
          Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}
        </button>

        <div className="browse-filter-panel">
          <div className="browse-search-control">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4.2 4.2" />
            </svg>
            <input
              type="search"
              placeholder="Search by caregiver name or location"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search caregivers by name or location"
            />
          </div>

          <div className="browse-filter-grid">
            <div className="browse-filter-field">
              <label htmlFor="browse-category-filter">Category</label>
              <select
                id="browse-category-filter"
                value={userCategory}
                onChange={(event) => onChangeUserCategory && onChangeUserCategory(event.target.value)}
              >
                <option value="">All support</option>
                <option value="caregiver">Caregiver support</option>
                <option value="household">Household help</option>
                <option value="both">Care + household</option>
              </select>
            </div>

            <div className="browse-filter-field">
              <label htmlFor="browse-service-filter">Service</label>
              <select
                id="browse-service-filter"
                value={serviceFilter}
                onChange={(event) => setServiceFilter(event.target.value)}
              >
                <option value="">Any service</option>
                {visibleServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.label || service.serviceName}
                  </option>
                ))}
              </select>
            </div>

            <div className="browse-filter-field">
              <label htmlFor="browse-work-type-filter">Work type</label>
              <select
                id="browse-work-type-filter"
                value={workTypeFilter}
                onChange={(event) => handleBrowseWorkTypeChange(event.target.value)}
              >
                <option value="">Any schedule</option>
                <option value="fulltime">Full time</option>
                <option value="parttime">Part time</option>
              </select>
            </div>

            <div className="browse-filter-field">
              <label htmlFor="browse-location-filter">Location</label>
              <input
                id="browse-location-filter"
                placeholder="City or area"
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
              />
            </div>

            <div className="browse-filter-field">
              <label htmlFor="browse-experience-filter">Experience</label>
              <select id="browse-experience-filter" value={minimumExperience} onChange={(event) => setMinimumExperience(event.target.value)}>
                <option value="">Any experience</option>
                <option value="1">1+ year</option>
                <option value="3">3+ years</option>
                <option value="5">5+ years</option>
              </select>
            </div>

            <div className="browse-filter-field">
              <label htmlFor="browse-rating-filter">Verified rating</label>
              <select id="browse-rating-filter" value={minimumRating} onChange={(event) => setMinimumRating(event.target.value)}>
                <option value="">Any verified rating</option>
                <option value="4">4.0+</option>
                <option value="4.5">4.5+</option>
              </select>
            </div>

            <label className="browse-verified-filter">
              <input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} />
              Verified by Sewak only
            </label>

            {workTypeFilter === "parttime" && (
              <div className="browse-filter-field">
                <label htmlFor="browse-shift-filter">Shift</label>
                <select
                  id="browse-shift-filter"
                  value={shiftFilter}
                  onChange={(event) => {
                    const value = event.target.value;
                    setShiftFilter(value);
                    onChangeShift && onChangeShift(value);
                  }}
                >
                  <option value="">Any shift</option>
                  {SHIFTS.map((shift) => (
                    <option key={shift} value={shift}>
                      {shift[0].toUpperCase() + shift.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {activeFilters.length > 0 && (
            <div className="browse-active-filters">
              <div className="browse-active-filters__list" aria-label="Active filters">
                {activeFilters.map((filter) => (
                  <span className="browse-filter-tag" key={filter}>{filter}</span>
                ))}
              </div>
              <button type="button" className="browse-filter-clear" onClick={clearFilters}>
                Clear all
              </button>
            </div>
          )}
        </div>

        {filtered.length > 0 ? (
          <>
            {featured.length > 0 && (
              <div className="browse-featured-callout">
                <span className="browse-featured-callout__star" aria-hidden="true">★</span>
                <div>
                  <strong>Top-rated caregivers</strong>
                  <span>Profiles with a rating of 4.5 or higher appear first.</span>
                </div>
              </div>
            )}
            <div className="browse-caregiver-grid">
              {[...featured, ...regular].map((caregiver) => (
                <BrowseCaregiverCard
                  key={caregiver.id}
                  caregiver={caregiver}
                  services={services}
                  onSelect={onSelectCaregiver}
                  onViewProfile={(profile) => navigate(`/caregivers/${profile.id}`)}
                  requireLogin={requireLogin}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="browse-empty-state">
            <div className="browse-empty-state__icon" aria-hidden="true">⌕</div>
            <h3>No caregivers match this search</h3>
            <p>Try a broader location, a different schedule, or clear your filters to see more profiles.</p>
            <button type="button" className="browse-filter-clear" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

        {filterSheetOpen ? (
          <div className="browse-filter-sheet-backdrop" role="presentation" onMouseDown={() => setFilterSheetOpen(false)}>
            <section ref={filterSheetRef} className="browse-filter-sheet" role="dialog" aria-modal="true" aria-label="Caregiver filters" tabIndex="-1" onMouseDown={(event) => event.stopPropagation()}>
              <div className="browse-filter-sheet__heading"><h2>Filters</h2><button type="button" onClick={() => setFilterSheetOpen(false)} aria-label="Close filters">Close</button></div>
              <label>Service<select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}><option value="">Any service</option>{visibleServices.map((service) => <option key={service.id} value={service.id}>{service.label || service.serviceName}</option>)}</select></label>
              <label>Location<input value={locationFilter} onChange={(event) => setLocationFilter(event.target.value)} placeholder="City or area" /></label>
              <label>Experience<select value={minimumExperience} onChange={(event) => setMinimumExperience(event.target.value)}><option value="">Any experience</option><option value="1">1+ year</option><option value="3">3+ years</option><option value="5">5+ years</option></select></label>
              <label>Verified rating<select value={minimumRating} onChange={(event) => setMinimumRating(event.target.value)}><option value="">Any verified rating</option><option value="4">4.0+</option><option value="4.5">4.5+</option></select></label>
              <label className="browse-verified-filter"><input type="checkbox" checked={verifiedOnly} onChange={(event) => setVerifiedOnly(event.target.checked)} /> Verified by Sewak only</label>
              <div className="browse-filter-sheet__actions"><button type="button" className="browse-filter-clear" onClick={clearFilters}>Clear all</button><button type="button" className="browse-card-action" onClick={() => setFilterSheetOpen(false)}>Show {filtered.length} {filtered.length === 1 ? "caregiver" : "caregivers"}</button></div>
            </section>
          </div>
        ) : null}
      </section>
    );
  }

  const categoryLabel =
    userCategory === "caregiver"
      ? "Care giver"
      : userCategory === "household"
      ? "Household"
      : userCategory === "both"
      ? "Both"
      : "All";

  return (
    <div>
      {/* Breadcrumb */}
      <div style={{ fontSize: 12, color: "var(--theme-text-muted)", marginBottom: 16 }}>
        <span>Home</span> &gt; <span>{categoryLabel}</span> &gt;{" "}
        <span>
          {workTypeFilter === "fulltime"
            ? "Full time"
            : workTypeFilter === "parttime"
            ? "Part time"
            : "Any"}
        </span>{" "}
        &gt; <span>Caregivers</span>
      </div>

      <h2 className="section-title">Available caregivers ({filtered.length})</h2>

      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="🔍 Search caregivers by name or location..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: "6px",
            border: "1px solid var(--theme-border-muted)",
            background: "var(--theme-button-text)",
            color: "var(--theme-text)",
            outline: "none",
          }}
        />
      </div>

      {/* Dropdown filters */}
      <div className="row" style={{ marginBottom: 16 }}>
        <div className="col">
          <label>Category</label>
          <select
            value={userCategory}
            onChange={(e) =>
              onChangeUserCategory && onChangeUserCategory(e.target.value)
            }
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--theme-border-muted)",
              background: "var(--theme-button-text)",
              color: "var(--theme-text)",
            }}
          >
            <option value="">All</option>
            <option value="caregiver">Care giver</option>
            <option value="household">Household</option>
            <option value="both">Both (Caregiver & Household)</option>
          </select>
        </div>

        <div className="col">
          <label>Work type</label>
          <select
            value={workTypeFilter}
            onChange={(e) => {
              const v = e.target.value;
              setWorkTypeFilter(v);
              if (onChangeWorkType) onChangeWorkType(v);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--theme-border-muted)",
              background: "var(--theme-button-text)",
              color: "var(--theme-text)",
            }}
          >
            <option value="">Any</option>
            <option value="fulltime">Full time</option>
            <option value="parttime">Part time</option>
          </select>
        </div>

        {workTypeFilter === "parttime" && (
          <div className="col">
            <label>Shift</label>
            <select
              value={shiftFilter}
              onChange={(e) => {
                const v = e.target.value;
                setShiftFilter(v);
                if (onChangeShift) onChangeShift(v);
              }}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid var(--theme-border-muted)",
                background: "var(--theme-button-text)",
                color: "var(--theme-text)",
              }}
            >
              <option value="">Any</option>
              {SHIFTS.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="col">
          <label>Location</label>
          <input
            placeholder="City / area"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "1px solid var(--theme-border-muted)",
              background: "var(--theme-button-text)",
              color: "var(--theme-text)",
            }}
          />
        </div>
      </div>

      {/* Service filter dropdown (optional, if you use it in UI) */}
      {/* 
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 13, color: "var(--theme-button-text)" }}>
          Service
        </label>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid var(--theme-text)",
            background: "var(--theme-surface)",
            color: "var(--theme-button-text)",
          }}
        >
          <option value="">Any</option>
          {visibleServices.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label || s.serviceName}
            </option>
          ))}
        </select>
      </div>
      */}

      {/* Featured section */}
      {featured.length > 0 && (
        <div
          style={{
            background: "var(--theme-help-soft)",
            border: "1px solid var(--theme-info-dark)",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: 16,
            color: "var(--theme-text)",
            fontWeight: 600,
          }}
        >
          ⭐ Featured caregivers
          <div
            style={{
              fontSize: 12,
              color: "var(--theme-text-muted)",
              fontWeight: "normal",
              marginTop: 4,
            }}
          >
            These caregivers have excellent ratings
          </div>
        </div>
      )}

      {featured.map((c) => (
        <CaregiverCard
          key={c.id}
          caregiver={c}
          services={services}
          onSelect={onSelectCaregiver}
          onViewProfile={(profile) => navigate(`/user/caregivers/${profile.id}`)}
          requireLogin={requireLogin}
          hasPaid={hasPaid}
        />
      ))}

      {regular.map((c) => (
        <CaregiverCard
          key={c.id}
          caregiver={c}
          services={services}
          onSelect={onSelectCaregiver}
          onViewProfile={(profile) => navigate(`/user/caregivers/${profile.id}`)}
          requireLogin={requireLogin}
          hasPaid={hasPaid}
        />
      ))}

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p className="empty-state-title">No caregivers found</p>
          <p className="empty-state-text">
            Try adjusting your filters or expanding your location
          </p>
          <button
            className="btn btn-outline"
            onClick={() => {
              setSearchTerm("");
              setServiceFilter("");
              setWorkTypeFilter("");
              setShiftFilter("");
              setLocationFilter("");
              if (onChangeWorkType) onChangeWorkType("");
              if (onChangeShift) onChangeShift("");
            }}
            style={{
              padding: "10px 16px",
              borderRadius: "6px",
              border: "1px solid var(--theme-border-muted)",
              background: "var(--theme-button-text)",
              color: "var(--theme-help)",
              cursor: "pointer",
              marginTop: 12,
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}
