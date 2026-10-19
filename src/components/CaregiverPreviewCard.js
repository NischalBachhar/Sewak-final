import React, { useId } from 'react';
import ProfileImage from './ProfileImage';
import { hasVerifiedRating } from '../bookingModel';
import { formatNpr } from '../config/brand';
import { VerificationBadge } from './CareExperience';
import RequestAvailability from './RequestAvailability';
import useSavedCare from '../useSavedCare';
import { caregiverBookingReason } from '../caregiverDiscovery';
import '../BrowsePage.css';
import './CaregiverPreview.css';

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

export default function CaregiverPreviewCard({ caregiver, services, onSelect, onViewProfile, requireLogin, compact = false }) {
  const bookingReason = caregiverBookingReason(caregiver);
  const { saved, toggle, enabled } = useSavedCare();
  const reasonId = useId();
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
    if (bookingReason) return;
    if (requireLogin) {
      localStorage.setItem("pendingBookingCaregiverId", caregiver.id);
      window.location.href = "/auth";
      return;
    }

    onSelect && onSelect(caregiver);
  };

  return (
    <article className={`browse-caregiver-card${compact ? " caregiver-preview-card" : ""}`}>
      {enabled && <div className="saved-care-card-control"><button type="button" className="sawak-save-button" aria-pressed={saved.includes(caregiver.id)} aria-label={(saved.includes(caregiver.id) ? 'Remove ' : 'Save ') + (caregiver.name || 'caregiver') + (saved.includes(caregiver.id) ? ' from saved caregivers' : ' to saved caregivers')} onClick={() => toggle(caregiver.id)}>{saved.includes(caregiver.id) ? '♥ Saved' : '♡ Save'}</button></div>}
      <div className="browse-caregiver-card__top">
        <div className="browse-caregiver-card__avatar">
          {caregiver.profileImage ? (
            <ProfileImage src={caregiver.profileImage} alt={caregiver.name || "Caregiver"} />
          ) : (
            getInitials(caregiver.name).slice(0, 2)
          )}
        </div>
        <div className="browse-caregiver-card__identity">
          <div className="browse-caregiver-card__name-row">
            <h3 title={caregiver.name || "Caregiver"}>{caregiver.name || "Caregiver"}</h3>
            {caregiver.verificationSource === "audited_v1" && caregiver.verified ? (
              <VerificationBadge
                state="verified"
                label="Verified"
                description="Verified by Sewak based on the approved records shown in this profile."
                compact
              />
            ) : <VerificationBadge state="not_verified" label="Verification not complete" compact />}
          </div>
          <RequestAvailability caregiver={caregiver} />
          <p className="browse-caregiver-card__location">
            {caregiver.location || "Location not listed"}
          </p>
          {caregiver.organizationName && (
            <p className="browse-caregiver-card__organization">
              {caregiver.organizationName}
            </p>
          )}
          {rating === null && <p className="browse-rating__count">No verified reviews yet</p>}
          {rating !== null && (
            <div className="browse-rating" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
              <span className="browse-rating__star" aria-hidden="true">★</span>
              <span>{rating.toFixed(1)}</span>
              <span className="browse-rating__count">({caregiver.reviewCount || 0} verified reviews)</span>
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
          <span className="browse-service-tag">Services not specified</span>
        )}
      </div>

      {!compact && <div className="browse-assurance-row" role="group" aria-label="Profile checks">
        {caregiver.verificationSource === "audited_v1" && caregiver.backgroundChecked && <span className="browse-assurance-tag">Background checked</span>}
        {caregiver.verificationSource === "audited_v1" && caregiver.verified && <span className="browse-assurance-tag">ID verified</span>}
        {caregiver.verificationSource === "audited_v1" && caregiver.isCertified && <span className="browse-assurance-tag browse-assurance-tag--certified">Certified</span>}
      </div>}

      {!compact && <dl className="browse-caregiver-card__stats">
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
      </dl>}

      <div className="browse-caregiver-card__footer">
        <div className={`browse-price${caregiver.hourlyRate ? "" : " browse-price--unlisted"}`}>
          <small>{caregiver.hourlyRate ? "Starting at" : "Rate"}</small>
          <strong>{Number.isFinite(caregiver.hourlyRate) && (caregiver.hourlyRate > 0 || caregiver.allowZeroRate) ? `${formatNpr(caregiver.hourlyRate)}/hour` : "Not configured"}</strong>
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
          disabled={Boolean(bookingReason)}
          aria-describedby={bookingReason ? reasonId : undefined}
        >
          {requireLogin ? "Sign in to book" : "Book now"}
          <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      {bookingReason && <p id={reasonId} className="caregiver-booking-reason">{bookingReason}</p>}
    </article>
  );
}
