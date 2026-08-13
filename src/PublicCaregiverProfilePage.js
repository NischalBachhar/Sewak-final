import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "./firebaseConfig";
import { formatNpr } from "./config/brand";
import { getCaregiverVerification } from "./bookingModel";
import {
  CaregiverStats,
  CaregiverTrustSummary,
  EmptyState,
  ErrorState,
  SkeletonCard,
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

export default function PublicCaregiverProfilePage({ signedIn = false }) {
  const { caregiverId } = useParams();
  const navigate = useNavigate();
  const [caregiver, setCaregiver] = useState(null);
  const [services, setServices] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setError("");
      try {
        const [caregiverSnap, servicesSnap, reviewsSnap] = await Promise.all([
          getDoc(doc(db, "publicCaregivers", caregiverId)),
          getDocs(collection(db, "publicServices")),
          getDocs(query(collection(db, "publicReviews"), where("caregiverId", "==", caregiverId))),
        ]);

        if (!caregiverSnap.exists()) {
          throw new Error("This caregiver profile is not available.");
        }

        if (!active) return;
        setCaregiver({ id: caregiverSnap.id, ...caregiverSnap.data() });
        setServices(servicesSnap.docs.map((item) => ({ id: item.id, ...item.data() })));
        setReviews(
          reviewsSnap.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((left, right) => {
              const leftDate = left.createdAt?.toDate?.() || new Date(0);
              const rightDate = right.createdAt?.toDate?.() || new Date(0);
              return rightDate - leftDate;
            }),
        );
      } catch (loadError) {
        if (active) setError(loadError.message || "We could not load this caregiver profile.");
      } finally {
        if (active) setLoading(false);
      }
    }

    if (caregiverId) loadProfile();
    return () => {
      active = false;
    };
  }, [caregiverId]);

  const serviceLabels = useMemo(
    () => (caregiver?.servicesOffered || []).map((service) => labelForService(service, services)).filter(Boolean),
    [caregiver, services],
  );

  const handleBook = () => {
    if (!caregiver) return;
    if (!signedIn) {
      localStorage.setItem("pendingBookingCaregiverId", caregiver.id);
      navigate("/auth");
      return;
    }
    navigate(`/user/book/${caregiver.id}`);
  };

  if (loading) {
    return (
      <main className="caregiver-profile-page caregiver-profile-page--loading" aria-busy="true">
        <SkeletonCard />
        <SkeletonCard />
      </main>
    );
  }

  if (error || !caregiver) {
    return (
      <main className="caregiver-profile-page">
        <ErrorState
          title="Caregiver profile unavailable"
          description={error || "This profile could not be found."}
          actionLabel="Browse caregivers"
          onAction={() => navigate("/browse")}
        />
      </main>
    );
  }

  const verifiedReviews = reviews.filter((review) => review.isVerifiedReview === true && Number(review.rating) >= 1);
  const verifiedReviewCount = verifiedReviews.length;
  const rating = verifiedReviewCount
    ? (verifiedReviews.reduce((sum, review) => sum + Number(review.rating), 0) / verifiedReviewCount).toFixed(1)
    : null;
  const availability = caregiver.isAvailable === false ? "Currently unavailable" : "Available to discuss care";
  const initials = (caregiver.name || "C")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <main
      className={`caregiver-profile-page${
        signedIn ? " caregiver-profile-page--with-mobile-nav" : ""
      }`}
    >
      <button className="caregiver-profile-page__back" type="button" onClick={() => navigate(-1)}>
        Back to results
      </button>

      <section className="caregiver-profile-hero" aria-labelledby="caregiver-profile-title">
        <div className="caregiver-profile-hero__identity">
          <div className="caregiver-profile-avatar">
            {caregiver.profileImage ? (
              <img src={caregiver.profileImage} alt={`${caregiver.name || "Caregiver"} profile`} />
            ) : (
              <span aria-hidden="true">{initials}</span>
            )}
          </div>
          <div>
            <p className="caregiver-profile-eyebrow">Caregiver profile</p>
            <h1 id="caregiver-profile-title">{caregiver.name || "Caregiver"}</h1>
            <p className="caregiver-profile-specialty">
              {serviceLabels[0] || "Care support"}
              {caregiver.location ? ` · ${caregiver.location}` : ""}
            </p>
            <p className={`caregiver-profile-availability${caregiver.isAvailable === false ? " is-unavailable" : ""}`}>
              <span aria-hidden="true" />
              {availability}
            </p>
          </div>
        </div>

        <div className="caregiver-profile-hero__summary">
          {rating ? (
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
          <button
            className="caregiver-profile-book"
            type="button"
            onClick={handleBook}
            disabled={caregiver.isAvailable === false}
          >
            {signedIn ? "Book caregiver" : "Sign in to book"}
          </button>
        </div>
      </section>

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
            {serviceLabels.length ? (
              <div className="caregiver-profile-skills">
                {serviceLabels.map((service) => <span key={service}>{service}</span>)}
              </div>
            ) : (
              <p className="caregiver-profile-muted">Services will be confirmed before the booking is accepted.</p>
            )}
          </section>

          <section className="caregiver-profile-section" aria-labelledby="reviews-heading">
            <p className="caregiver-profile-eyebrow">Verified reviews</p>
            <h2 id="reviews-heading">Feedback from completed bookings</h2>
            {verifiedReviews.length ? (
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
          <CaregiverTrustSummary
            caregiverName={caregiver.name}
            verificationItems={getCaregiverVerification(caregiver)}
            heading="Trust and verification"
            summary="A green status only appears when the matching record is approved by Sewak."
            overallState={caregiver.verified ? "verified" : "not_verified"}
            overallLabel={caregiver.verified ? "Verified by Sewak" : "Verification not complete"}
            experienceYears={caregiver.experience}
            completedSessions={caregiver.jobsCompleted}
            rating={rating}
            verifiedReviewCount={verifiedReviewCount}
          />
          <CaregiverStats
            stats={[
              { id: "location", label: "Location", value: caregiver.location || "Not listed" },
              { id: "availability", label: "Availability", value: caregiver.isAvailable === false ? "Unavailable" : "Available" },
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
        <button type="button" onClick={handleBook} disabled={caregiver.isAvailable === false}>
          {signedIn ? "Book now" : "Sign in to book"}
        </button>
      </div>
    </main>
  );
}
