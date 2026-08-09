import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import CaregiverListPage from "./CaregiverListPage";
import logoSewak from "./logoSewak.jpeg";
import "./BrowsePage.css";

function BrowseGlyph({ type }) {
  const shared = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  };

  if (type === "care") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...shared} d="M20.8 8.2c0 5.2-8.8 10.1-8.8 10.1S3.2 13.4 3.2 8.2A4.6 4.6 0 0 1 12 6.3a4.6 4.6 0 0 1 8.8 1.9Z" />
      </svg>
    );
  }

  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path {...shared} d="m3.5 10 8.5-6.8 8.5 6.8v9.2a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6V10Z" />
        <path {...shared} d="M9.3 20.8v-6h5.4v6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle {...shared} cx="12" cy="12" r="8.8" />
      <path {...shared} d="M8.5 12h7M12 8.5v7" />
    </svg>
  );
}

const categoryOptions = [
  {
    value: "",
    icon: "all",
    label: "All support",
    description: "See every available profile",
  },
  {
    value: "caregiver",
    icon: "care",
    label: "Caregiver support",
    description: "Thoughtful care at home",
  },
  {
    value: "household",
    icon: "home",
    label: "Household help",
    description: "Reliable help for daily life",
  },
];

const workOptions = [
  { value: "", label: "Any schedule" },
  { value: "fulltime", label: "Full time" },
  { value: "parttime", label: "Part time" },
];

export default function BrowsePage() {
  const navigate = useNavigate();
  const [userCategory, setUserCategory] = useState("");
  const [userWorkType, setUserWorkType] = useState("");
  const [userShift, setUserShift] = useState("");

  const handleWorkTypeChange = (value) => {
    setUserWorkType(value);
    if (value !== "parttime") setUserShift("");
  };

  const scrollToResults = () => {
    document
      .getElementById("browse-caregiver-results")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="browse-page">
      <div className="browse-page__glow browse-page__glow--top" aria-hidden="true" />
      <div className="browse-page__glow browse-page__glow--bottom" aria-hidden="true" />

      <header className="browse-nav">
        <button
          type="button"
          className="browse-brand"
          onClick={() => navigate("/browse")}
          aria-label="Sewak home"
        >
          <span className="browse-brand__mark">
            <img src={logoSewak} alt="" />
          </span>
          <span>
            <strong>Sewak</strong>
            <small>Care, close to home</small>
          </span>
        </button>

        <button
          type="button"
          className="browse-sign-in"
          onClick={() => navigate("/auth")}
        >
          Sign in
          <span aria-hidden="true">→</span>
        </button>
      </header>

      <section className="browse-hero" aria-labelledby="browse-hero-title">
        <div className="browse-hero__content">
          <p className="browse-eyebrow">
            <span className="browse-eyebrow__dot" aria-hidden="true" />
            Find support with confidence
          </p>
          <h1 id="browse-hero-title">
            Care that feels <em>close to home.</em>
          </h1>
          <p className="browse-hero__copy">
            Explore local caregiver and household-help profiles, compare
            availability, and book when you&apos;re ready.
          </p>
          <div className="browse-hero__actions">
            <button type="button" className="browse-primary-action" onClick={scrollToResults}>
              Explore caregivers
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="browse-secondary-action" onClick={() => navigate("/auth")}>
              Create an account
            </button>
          </div>
          <div className="browse-trust-list" aria-label="How Sewak helps">
            <span>Search profiles</span>
            <span>Compare schedules</span>
            <span>Book simply</span>
          </div>
        </div>

        <div className="browse-hero__visual" aria-label="Care and household support">
          <div className="browse-hero__orbit browse-hero__orbit--one" aria-hidden="true" />
          <div className="browse-hero__orbit browse-hero__orbit--two" aria-hidden="true" />
          <div className="browse-hero-card browse-hero-card--main">
            <div className="browse-hero-card__icon browse-hero-card__icon--care">
              <BrowseGlyph type="care" />
            </div>
            <div>
              <strong>Support for every day</strong>
              <span>Find a fit for your home</span>
            </div>
          </div>
          <div className="browse-hero-card browse-hero-card--floating">
            <div className="browse-hero-card__icon browse-hero-card__icon--home">
              <BrowseGlyph type="home" />
            </div>
            <div>
              <strong>Care &amp; home help</strong>
              <span>One simple search</span>
            </div>
          </div>
          <div className="browse-hero-art" aria-hidden="true">
            <div className="browse-hero-art__sun" />
            <div className="browse-hero-art__house">
              <span />
              <span />
              <span />
            </div>
            <div className="browse-hero-art__leaf browse-hero-art__leaf--left" />
            <div className="browse-hero-art__leaf browse-hero-art__leaf--right" />
          </div>
        </div>
      </section>

      <section className="browse-preferences" aria-labelledby="browse-preferences-title">
        <div className="browse-section-heading">
          <div>
            <p className="browse-section-kicker">Personalize your search</p>
            <h2 id="browse-preferences-title">What kind of help do you need?</h2>
          </div>
          <p>Choose a category and schedule to surface the most relevant people.</p>
        </div>

        <div className="browse-category-grid" role="group" aria-label="Support category">
          {categoryOptions.map((option) => {
            const active = userCategory === option.value;
            return (
              <button
                type="button"
                key={option.value || "all"}
                className={`browse-category-option${active ? " is-active" : ""}`}
                onClick={() => setUserCategory(option.value)}
                aria-pressed={active}
              >
                <span className="browse-category-option__icon">
                  <BrowseGlyph type={option.icon} />
                </span>
                <span className="browse-category-option__copy">
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
                <span className="browse-category-option__check" aria-hidden="true">✓</span>
              </button>
            );
          })}
        </div>

        <div className="browse-schedule-row">
          <div>
            <p className="browse-schedule-row__label">Preferred schedule</p>
            <div className="browse-segmented-control" role="group" aria-label="Preferred work type">
              {workOptions.map((option) => (
                <button
                  type="button"
                  key={option.value || "any"}
                  className={userWorkType === option.value ? "is-active" : ""}
                  onClick={() => handleWorkTypeChange(option.value)}
                  aria-pressed={userWorkType === option.value}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {userWorkType === "parttime" && (
            <div className="browse-shift-control" role="group" aria-label="Preferred shift">
              <p className="browse-schedule-row__label">Preferred shift</p>
              <div className="browse-shift-options">
                {["morning", "day", "night"].map((shift) => (
                  <button
                    type="button"
                    key={shift}
                    className={userShift === shift ? "is-active" : ""}
                    onClick={() => setUserShift(shift)}
                    aria-pressed={userShift === shift}
                  >
                    {shift}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="browse-caregiver-results" className="browse-results">
        <CaregiverListPage
          variant="browse"
          onSelectCaregiver={() => navigate("/auth")}
          preselectedWorkType={userWorkType}
          preselectedShift={userShift}
          userCategory={userCategory}
          onChangeUserCategory={setUserCategory}
          onChangeWorkType={handleWorkTypeChange}
          onChangeShift={setUserShift}
          requireLogin
        />
      </section>
    </main>
  );
}
