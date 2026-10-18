import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiRequest } from "../apiClient";
import { formatNpr } from "../config/brand";
import { hasVerifiedRating } from "../bookingModel";
import ProfileImage from "./ProfileImage";
import AvailabilityBadge from "./AvailabilityBadge";
import "./CaregiverPreview.css";

const INITIAL = { loading: true, error: "", caregivers: [], services: [] };

// Reuses the existing public projection and booking eligibility rather than
// querying private caregiver documents or inferring availability from shifts.
export default function CaregiverPreview({ audience = "guest" }) {
  const navigate = useNavigate();
  const customer = audience === "customer";
  const browsePath = customer ? "/user" : "/browse";
  const [result, setResult] = useState(INITIAL);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setResult((previous) => ({ ...previous, loading: true, error: "" }));
    const load = async () => {
      try {
        const [caregivers, services] = await Promise.all([
          apiRequest("/api/query", {
            method: "POST",
            json: { path: "publicCaregivers", search: { availability: "accepting" }, limit: 12 },
          }),
          apiRequest("/api/query", {
            method: "POST",
            json: { path: "publicServices", limit: 50 },
          }).catch(() => ({ items: [] })),
        ]);
        if (!active) return;
        const eligible = (caregivers.items || [])
          .map((item) => ({ id: item.id, ...item.data }))
          .filter((caregiver) =>
            caregiver.isApproved === true &&
            caregiver.isAvailable === true &&
            caregiver.isSuspended !== true &&
            caregiver.isBlacklisted !== true &&
            Array.isArray(caregiver.servicesOffered) &&
            caregiver.servicesOffered.length > 0
          )
          .slice(0, 3);
        setResult({
          loading: false,
          error: "",
          caregivers: eligible,
          services: (services.items || []).map((item) => ({ id: item.id, ...item.data })),
        });
      } catch {
        if (active) setResult({ loading: false, error: "Caregiver profiles could not be loaded.", caregivers: [], services: [] });
      }
    };
    load();
    return () => { active = false; };
  }, [retry]);

  const book = (caregiver) => {
    if (!customer) {
      // This is the existing sign-in continuation convention for bookings.
      try { window.localStorage.setItem("pendingBookingCaregiverId", caregiver.id); } catch { /* optional */ }
      navigate("/auth");
      return;
    }
    navigate(`/user/book/${encodeURIComponent(caregiver.id)}`);
  };

  const serviceLabels = (caregiver) => (caregiver.servicesOffered || [])
    .map((id) => result.services.find((service) => service.id === id)?.label ||
      result.services.find((service) => service.id === id)?.serviceName)
    .filter(Boolean).slice(0, 2);

  return (
    <section id="caregivers" className={`caregiver-preview caregiver-preview--${audience}`} aria-labelledby={`caregiver-preview-heading-${audience}`}>
      <div className="caregiver-preview__heading">
        <div>
          <p className="caregiver-preview__eyebrow">Real care professionals</p>
          <h2 id={`caregiver-preview-heading-${audience}`}>{customer ? "Explore caregivers" : "Meet caregivers ready to help"}</h2>
          <p>Browse actual profiles and see who's accepting care requests.</p>
        </div>
        <Link to={browsePath} className="caregiver-preview__all">View all caregivers <span aria-hidden="true">→</span></Link>
      </div>
      {result.loading ? (
        <div className="caregiver-preview__loading" role="status">Finding care professionals…</div>
      ) : result.error ? (
        <div className="caregiver-preview__empty" role="status">
          <p>{result.error}</p>
          <button type="button" onClick={() => setRetry((value) => value + 1)}>Try again</button>
        </div>
      ) : result.caregivers.length === 0 ? (
        <div className="caregiver-preview__empty">
          <p>No caregivers are currently accepting requests. You can still explore public profiles for future availability.</p>
          <Link to={`${browsePath}?availability=all`}>Explore caregiver profiles <span aria-hidden="true">→</span></Link>
        </div>
      ) : (
        <div className="caregiver-preview__grid">
          {result.caregivers.map((caregiver) => {
            const labels = serviceLabels(caregiver);
            const rated = hasVerifiedRating(caregiver);
            const rate = Number(caregiver.hourlyRate);
            const configured = Number.isFinite(rate) && (rate > 0 || (rate === 0 && caregiver.allowZeroRate === true));
            return (
              <article key={caregiver.id} className="caregiver-preview__card">
                <div className="caregiver-preview__top">
                  <div className="caregiver-preview__photo">
                    {caregiver.profileImage ? <ProfileImage src={caregiver.profileImage} alt={caregiver.name || "Care professional"} /> : <span aria-hidden="true">{String(caregiver.name || "C").trim().charAt(0).toUpperCase()}</span>}
                  </div>
                  <div className="caregiver-preview__identity">
                    <h3>{caregiver.name || "Care professional"}</h3>
                    <p>{caregiver.location || "Location not listed"}</p>
                    <AvailabilityBadge isAvailable={caregiver.isAvailable} />
                  </div>
                </div>
                <p className="caregiver-preview__services">{labels.length ? labels.join(" · ") : "See profile for service details"}</p>
                <div className="caregiver-preview__facts">
                  <span>{rated ? `★ ${Number(caregiver.rating).toFixed(1)} (${caregiver.reviewCount} verified reviews)` : "No verified reviews yet"}</span>
                  <strong>{configured ? `${formatNpr(rate)}/hour` : "Rate not listed"}</strong>
                </div>
                <p className="caregiver-preview__note">Requests are subject to caregiver acceptance and schedule confirmation.</p>
                <div className="caregiver-preview__actions">
                  <Link to={customer ? `/user/caregivers/${encodeURIComponent(caregiver.id)}` : `/caregivers/${encodeURIComponent(caregiver.id)}`} className="caregiver-preview__profile">View profile</Link>
                  <button type="button" onClick={() => book(caregiver)} className="caregiver-preview__book">{customer ? "Request care" : "Sign in to book"} <span aria-hidden="true">→</span></button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
