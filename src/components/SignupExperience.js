import React from "react";
import logo from "../assets/sewak-care-mark.svg";
import { LoginIcon } from "./LoginExperience";

export function SignupIcon({ name }) {
  const paths = {
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
    organization: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h1m4 0h1M9 11h1m4 0h1m-5 10v-6h4v6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  if (!paths[name]) return <LoginIcon name={name} />;
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export default function SignupExperience() {
  return (
    <section className="signup-experience sewak2-signup" aria-labelledby="signup-hero-title">
      <div className="signup-brand"><img src={logo} width="44" height="44" alt="" /><span>Sewak<small>Care, closer to home.</small></span></div>
      <p className="signup-eyebrow">Better connections. Better care.</p>
      <h2 id="signup-hero-title">There is room for <em>everyone</em> in care.</h2>
      <p className="signup-description">Join as a family, independent care professional or organization. Find support, share your skills and help communities thrive.</p>
      <div className="sewak2-signup-image">
        <img src="/images/sewak2-family-care.webp"
          width="1000" height="690" alt="A parent sharing a story with her daughter at home" loading="eager"
          onError={event => { event.currentTarget.onerror = null; event.currentTarget.src = "/images/care-for-every-generation.webp"; }} />
        <span>People first. Always.</span>
      </div>
      <ul className="signup-trust" aria-label="Care with confidence">
        <li><SignupIcon name="shield" />Review verification information</li>
        <li><SignupIcon name="check" />Flexible care opportunities</li>
        <li><SignupIcon name="clock" />Booking requests, all in one place</li>
      </ul>
      <p className="signup-hero-note">Care that fits real life, for families across Nepal.</p>
    </section>
  );
}
