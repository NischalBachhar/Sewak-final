import { requestAvailability, caregiverBookingReason } from './caregiverDiscovery';
import PublicHeader from './components/PublicHeader';
import PublicFooter from './components/PublicFooter';
import { kathmanduDate } from './bookingValidation';
import { readCareIntent, saveCareIntent } from './bookingIntent';
import ProfileImage from "./components/ProfileImage";
import useSavedCare from './useSavedCare';
import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "./d1Client";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { careSearchReturnPath } from './careSearchNavigation';
import { db } from "./d1Client";

import { formatNpr } from "./config/brand";
import { getCaregiverVerification } from "./bookingModel";
import {
  CaregiverStats,
  CaregiverTrustSummary,
  EmptyState,
  ErrorState,
  SkeletonCard,
  VerificationBadge,
} from "./components/CareExperience";
import "./CaregiverProfilePage.css";

const labelForService = (value, services) => {
  const raw = String(value || "");
  const normalized = raw.trim().toLowerCase();
  const match = services.find((service) => {
    const candidates = [service.id, service.label, service.serviceName];
    return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === normalized);
  });
  return match?.label || match?.serviceName || raw.replace(/_/g, " ") || "Care support";
};

const publicProfileLoadError = (loadError) => {
  if (loadError?.code === "permission-denied") {
    return "Caregiver profiles are temporarily unavailable while access is being updated. Please try again shortly.";
  }

  if (loadError?.message === "This caregiver profile is not available.") {
    return loadError.message;
  }

  return "We couldn't load this caregiver profile right now. Please try again shortly.";
};

export default function PublicCaregiverProfilePage({ signedIn = false }) {
  const { caregiverId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = careSearchReturnPath(location.state?.careSearchReturnTo, signedIn);
  const { saved, toggle, enabled } = useSavedCare();
  const [preferredDate, setPreferredDate] = useState(() => readCareIntent(caregiverId).date || '');
  const [preferredTime, setPreferredTime] = useState(() => readCareIntent(caregiverId).time || '');
  const [caregiver, setCaregiver] = useState(null);
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [servicesUnavailable, setServicesUnavailable] = useState(false);
  const [reviewsUnavailable, setReviewsUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");
      setCaregiver(null);
      setServices([]);
      setReviews([]);
      setServicesUnavailable(false);
      setReviewsUnavailable(false);
      setDetailsLoading(true);
      try {
        const caregiverSnap = await getDoc(
          doc(db, "publicCaregivers", caregiverId),
        );

        if (!caregiverSnap.exists()) {
          throw new Error("This caregiver profile is not available.");
        }
        if (!active) return;
        // Show the real profile, rate and request panel as soon as they arrive.
        // Optional service labels and reviews should not hold up booking.
        setCaregiver({ id: caregiverSnap.id, ...caregiverSnap.data() });
        setLoading(false);

        // The main profile is a standalone, PII-free public projection. Do
        // not hide it just because optional service labels or review cards
        // are temporarily unavailable during an access-rule rollout.
        const [servicesResult, reviewsResult] = await Promise.allSettled([
          getDocs(collection(db, "publicServices")),
          getDocs(
            query(
              collection(db, "publicReviews"),
              where("caregiverId", "==", caregiverId),
            ),
          ),
        ]);

        if (!active) return;
        if (servicesResult.status === "fulfilled") {
          setServices(
            servicesResult.value.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })),
          );
        } else {
          console.warn("Error loading public service labels:");
          setServicesUnavailable(true);
        }

        if (reviewsResult.status === "fulfilled") {
          setReviews(
            reviewsResult.value.docs
              .map((item) => ({ id: item.id, ...item.data() }))
              .sort((left, right) => {
                const leftDate = left.createdAt?.toDate?.() || new Date(0);
                const rightDate = right.createdAt?.toDate?.() || new Date(0);
                return rightDate - leftDate;
              }),
          );
        } else {
          console.warn("Error loading public reviews:");
          setReviewsUnavailable(true);
        }
      } catch (loadError) {
        if (active) setError(publicProfileLoadError(loadError));
      } finally {
        if (active) { setLoading(false); setDetailsLoading(false); }
      }
    }

    if (caregiverId) {
      loadProfile();
    } else {
      setError("This caregiver profile could not be found.");
      setLoading(false);
    }
    return () => {
      active = false;
    };
  }, [caregiverId]);

  const serviceLabels = useMemo(
    () => (caregiver?.servicesOffered || []).map((service) => labelForService(service, services)).filter(Boolean),
    [caregiver, services],
  );

  useEffect(() => { const intent = readCareIntent(caregiverId); setPreferredDate(intent.date || ''); setPreferredTime(intent.time || ''); }, [caregiverId]);
  const showRequestPanel = () => {
    document.getElementById('request-care-title')?.focus?.({ preventScroll: true });
    document.getElementById('request-care')?.scrollIntoView?.({ block: 'start', behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  useEffect(() => {
    if (caregiver && location.hash === '#request-care') {
      document.getElementById('request-care-title')?.focus?.({ preventScroll: true });
      document.getElementById('request-care')?.scrollIntoView?.({ block: 'start' });
    }
  }, [caregiver, location.hash]);

  const handleBook = () => {
    if (!caregiver || caregiverBookingReason(caregiver)) return;
    saveCareIntent(caregiver.id, preferredDate, preferredTime);
    if (!signedIn) {
      localStorage.setItem("pendingBookingCaregiverId", caregiver.id);
      navigate("/auth");
      return;
    }
    navigate(`/user/book/${caregiver.id}`);
  };

  if (loading) {
    return (
      <div className="marketplace-profile-shell">{!signedIn && <PublicHeader />}<main id="main-content" className="caregiver-profile-page caregiver-profile-page--loading" aria-busy="true">
        <SkeletonCard />
        <SkeletonCard />
      </main>{!signedIn && <PublicFooter />}</div>
    );
  }

  if (error || !caregiver) {
    return (
      <div className="marketplace-profile-shell">{!signedIn && <PublicHeader />}<main id="main-content" className="caregiver-profile-page">
        <ErrorState
          title="Caregiver profile unavailable"
          description={error || "This profile could not be found."}
          actionLabel="Browse caregivers"
          onAction={() => navigate(returnTo)}
        />
      </main>{!signedIn && <PublicFooter />}</div>
    );
  }

  const verifiedReviews = reviews.filter((review) => review.isVerifiedReview === true && Number(review.rating) >= 1);
  const verifiedReviewCount = verifiedReviews.length;
  const rating = verifiedReviewCount
    ? (verifiedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / verifiedReviewCount).toFixed(1)
    : null;
  const availabilityStatus = requestAvailability(caregiver);
  const availability = availabilityStatus.label;
  const bookingReason = caregiverBookingReason(caregiver);
  const initials = (caregiver.name || "C")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="marketplace-profile-shell">{!signedIn && <PublicHeader />}<main id="main-content"
      className={`caregiver-profile-page${
        signedIn ? " caregiver-profile-page--with-mobile-nav" : ""
      }`}
    >
      <button className="caregiver-profile-page__back" type="button" onClick={() => navigate(returnTo, { replace: true })}>
        Back to results
      </button>

      <section className="caregiver-profile-hero" aria-labelledby="caregiver-profile-title">
        <div className="caregiver-profile-hero__identity">
          <div className="caregiver-profile-avatar">
            {caregiver.profileImage ? (
              <ProfileImage src={caregiver.profileImage} alt={`${caregiver.name || "Caregiver"} profile`} />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </div>
          <div>
            <p className="caregiver-profile-eyebrow">Caregiver profile</p>
            <h1 id="caregiver-profile-title">{caregiver.name || "Caregiver"}</h1>
            <p className="caregiver-profile-specialty">
              {detailsLoading ? 'Care support' : serviceLabels[0] || "Care support"}
              {caregiver.location ? ` · ${caregiver.location}` : ""}
            </p>
            <p className="profile-experience">{caregiver.experience ? `${caregiver.experience}+ years experience` : "Experience not listed"} · {caregiver.jobsCompleted || 0} completed sessions</p>
            <VerificationBadge state={caregiver.verificationSource === "audited_v1" && caregiver.verified ? "verified" : "not_verified"} label={caregiver.verificationSource === "audited_v1" && caregiver.verified ? "Verified by Sewak" : "Verification not complete"} compact />
            <p className={`caregiver-profile-availability${availabilityStatus.state !== 'accepting' ? " is-unavailable" : ""}`}>
              <span aria-hidden="true" />
              {availability}
            </p>
          </div>
        </div>

        <div className="caregiver-profile-hero__summary">
          {detailsLoading ? <p className="caregiver-profile-rating caregiver-profile-rating--muted" role="status">Loading verified reviews…</p> : rating ? (
            <p className="caregiver-profile-rating" aria-label={`${rating} out of 5 from ${verifiedReviewCount} verified reviews`}>
              <strong>★ {rating}</strong>
              <span>{verifiedReviewCount} verified {verifiedReviewCount === 1 ? "review" : "reviews"}</span>
            </p>
          ) : (
            <p className="caregiver-profile-rating caregiver-profile-rating--muted">No verified reviews yet</p>
          )}
          <p className="caregiver-profile-price">
            <span>Starting from</span>
            <strong>{formatNpr(caregiver.hourlyRate)}/hr</strong>
          </p>
          {enabled && <button type="button" className="sawak-save-button" aria-pressed={saved.includes(caregiver.id)} onClick={() => toggle(caregiver.id)}>{saved.includes(caregiver.id) ? '♥ Saved' : '♡ Save caregiver'}</button>}
          <button
            className="caregiver-profile-book"
            type="button"
            onClick={showRequestPanel}
            disabled={Boolean(bookingReason)}
            aria-describedby={bookingReason ? 'caregiver-booking-reason' : undefined}
          >
            Request availability
          </button>
        </div>
      </section>

      {bookingReason && <p id="caregiver-booking-reason" className="caregiver-booking-reason" role="status">{bookingReason}</p>}
      <section className="caregiver-profile-grid">
        <div className="caregiver-profile-stack">
          <section className="caregiver-profile-section" aria-labelledby="about-heading">
            <p className="caregiver-profile-eyebrow">About</p>
            <h2 id="about-heading">A clear view before you book</h2>
            <p>{caregiver.bio || "This caregiver has not added an introduction yet. Ask about care needs and schedule before confirming your booking."}</p>
          </section>

          <section className="caregiver-profile-section" aria-labelledby="skills-heading">
            <p className="caregiver-profile-eyebrow">Skills</p>
            <h2 id="skills-heading">Care and support offered</h2>
            {detailsLoading ? <p role="status">Loading care and support details…</p> : servicesUnavailable ? (
              <p className="caregiver-profile-muted">
                Service details are temporarily unavailable. Confirm the care
                needed before booking.
              </p>
            ) : serviceLabels.length ? (
              <div className="caregiver-profile-skills">
                {serviceLabels.map((service) => <span key={service}>{service}</span>)}
              </div>
            ) : (
              <p className="caregiver-profile-muted">Services not specified. Booking is available after this caregiver adds services.</p>
            )}
          </section>

          <section className="caregiver-profile-section" aria-labelledby="reviews-heading">
            <p className="caregiver-profile-eyebrow">Verified reviews</p>
            <h2 id="reviews-heading">Feedback from completed bookings</h2>
            {detailsLoading ? <p role="status">Loading verified reviews…</p> : reviewsUnavailable ? (
              <p className="caregiver-profile-muted">
                Verified review details are temporarily unavailable. Please try
                again shortly.
              </p>
            ) : verifiedReviews.length ? (
              <div className="caregiver-profile-reviews">
                {verifiedReviews.slice(0, 4).map((review) => (
                  <article className="caregiver-profile-review" key={review.id}>
                    <strong>★ {review.rating}/5</strong>
                    {review.comment ? <p>{review.comment}</p> : <p className="caregiver-profile-muted">Verified customer rating</p>}
                    <small>Verified after a completed booking</small>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No verified reviews yet"
                description="Reviews can only be submitted by customers after a completed care booking."
                compact
              />
            )}
          </section>
        </div>

        <aside className="caregiver-profile-aside">
          <form id="request-care" className="care-request-panel" aria-labelledby="request-care-title" onSubmit={event => { event.preventDefault(); handleBook(); }}>
            <p className="care-eyebrow">Your next step</p><h2 id="request-care-title" tabIndex={-1}>Request availability</h2>
            <p className="care-request-panel__price">{formatNpr(caregiver.hourlyRate)}<small> / hour, starting rate</small></p>
            <label>Preferred date (optional)<input type="date" min={kathmanduDate()} value={preferredDate} onChange={event => setPreferredDate(event.target.value)} /></label>
            <label>Preferred start time (optional)<input type="time" value={preferredTime} onChange={event => setPreferredTime(event.target.value)} /></label>
            <button type="submit" className="care-primary-button" disabled={Boolean(bookingReason)} aria-describedby={bookingReason ? 'caregiver-booking-reason' : undefined}>Continue to request <span aria-hidden="true">→</span></button>
            <p>Times are in Nepal time. {signedIn ? 'Review your care needs and quote next.' : 'Sign in or create an account to send your request.'} Your caregiver must accept before care is confirmed.</p>
          </form>
          <details className="profile-verification"><summary>Trust and verification details</summary>
          <CaregiverTrustSummary
            caregiverName={caregiver.name}
            verificationItems={[...getCaregiverVerification(caregiver), {key:'police',label:'Police Clearance Verified',state:caregiver.verificationSource==='audited_v1'?caregiver.policeClearanceVerificationStatus:'not_submitted'}]}
            heading="Trust and verification"
            summary="See which records Sewak has reviewed. Incomplete checks are clearly marked."
            overallState={(caregiver.verificationSource === "audited_v1" && caregiver.verified) ? "verified" : "not_verified"}
            overallLabel={(caregiver.verificationSource === "audited_v1" && caregiver.verified) ? "Verified by Sewak" : "Verification not complete"}
            experienceYears={caregiver.experience}
            completedSessions={caregiver.jobsCompleted}
            rating={rating}
            verifiedReviewCount={verifiedReviewCount}
          />
          </details>
          <CaregiverStats
            stats={[
              { id: "location", label: "Location", value: caregiver.location || "Not listed" },
              { id: "availability", label: "Availability", value: availability },
            ]}
          />
          <section className="caregiver-profile-section caregiver-profile-section--pricing">
            <p className="caregiver-profile-eyebrow">Schedule and pricing</p>
            <h2>Plan the next step</h2>
            <dl>
              <div><dt>Schedule</dt><dd>{caregiver.workType === "fulltime" ? "Full time" : caregiver.workType === "parttime" ? "Part time" : "To be confirmed"}</dd></div>
              <div><dt>Preferred shifts</dt><dd>{(caregiver.shifts || []).length ? caregiver.shifts.join(", ") : "To be confirmed"}</dd></div>
              <div><dt>Starting price</dt><dd>{formatNpr(caregiver.hourlyRate)}/hr</dd></div>
            </dl>
          </section>
        </aside>
      </section>

      <div className="caregiver-profile-sticky-book" aria-label="Book this caregiver">
        <span>{formatNpr(caregiver.hourlyRate)}/hr</span>
        <button type="button" onClick={showRequestPanel} disabled={Boolean(bookingReason)} aria-describedby={bookingReason ? 'caregiver-booking-reason' : undefined}>
          Request availability
        </button>
      </div>
    </main>{!signedIn && <PublicFooter />}</div>
  );
}
