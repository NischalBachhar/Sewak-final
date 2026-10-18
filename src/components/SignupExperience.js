import React from "react";
import logo from "../logoSewak.jpeg";
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
    <section className="signup-experience" aria-labelledby="signup-hero-title">
      <div className="signup-brand"><img src={logo} width="44" height="44" alt="" /><span>Sewak<small>Care, closer to home.</small></span></div>
      <p className="signup-eyebrow">A little help. A lot of heart.</p>
      <h1 id="signup-hero-title">Care you can trust,<br />for every <em>stage of life.</em></h1>
      <p className="signup-description">Find caregivers and household support for the people who matter most.</p>
      <ul className="signup-trust" aria-label="Care with confidence">
        <li><SignupIcon name="shield" />Profile verification details</li>
        <li><SignupIcon name="check" />Admin-reviewed profiles</li>
        <li><SignupIcon name="clock" />Flexible care options</li>
      </ul>
      <div className="signup-scene" role="img" aria-label="Illustration connecting a care partner with a family through Sewak, for support at every stage of life and help at home.">
        <div className="signup-scene-orbit" aria-hidden="true" />
        <div className="signup-scene-dot signup-scene-dot--one" aria-hidden="true" />
        <div className="signup-scene-dot signup-scene-dot--two" aria-hidden="true" />
        <div className="signup-caregiver" aria-hidden="true">
          <div className="signup-portrait"><svg viewBox="0 0 80 80" fill="none"><path d="M12 80c0-22 12-33 28-33s28 11 28 33" fill="var(--brand-coral)" /><path d="M24 27c0-15 8-22 17-22 15 0 21 13 17 32l-33 4Z" fill="#544034" /><path d="M34 44h13v12c-4 5-10 5-13 0Z" fill="#c9926a" /><ellipse cx="40" cy="30" rx="15" ry="19" fill="#dfb18a" /><path d="M24 27c0-14 8-22 17-22 13 0 20 12 18 24-8-2-14-8-17-15-4 7-10 11-18 13Z" fill="#544034" /><path d="M35 36q5 5 10 0" stroke="#805b43" strokeWidth="1.7" strokeLinecap="round" /><circle cx="34" cy="28" r="1.3" fill="#544034" /><circle cx="46" cy="28" r="1.3" fill="#544034" /><path d="m29 55 11 13 12-13" stroke="#f4f0e7" strokeWidth="3" /></svg></div>
          <div><small>A helping hand</small><strong>Your care partner</strong><span>Thoughtful care, at home</span></div>
          <span className="signup-verified"><SignupIcon name="heart" />Connected care</span>
        </div>
        <div className="signup-heart" aria-hidden="true"><SignupIcon name="heart" /></div>
        <div className="signup-family" aria-hidden="true"><span className="signup-family-icon"><SignupIcon name="home" /></span><div><strong>Your family</strong><small>At the heart of it all</small></div><SignupIcon name="heart" /></div>
        <div className="signup-care-chips" aria-hidden="true"><span>Every generation</span><span>Daily support</span><span>Household help</span></div>
      </div>
      <p className="signup-hero-note">For the everyday moments. And the ones that matter most.</p>
    </section>
  );
}
