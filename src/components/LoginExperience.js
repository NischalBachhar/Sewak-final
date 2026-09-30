import React from "react";
import logo from "../logoSewak.jpeg";
import careIllustration from "../assets/login-care.svg";

// Small, local line icons keep the sign-in page independent of an icon package.
export function LoginIcon({ name }) {
  const paths = {
    mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    "eye-off": <><path d="m3 3 18 18M10 5.2c6.7-1.2 12 6.8 12 6.8a20 20 0 0 1-3 3.8M6.1 6.1A20 20 0 0 0 2 12s3.5 7 10 7a11 11 0 0 0 4-1m-6-8a3 3 0 0 0 4 4" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    heart: <path d="M20.5 4.8a5.5 5.5 0 0 0-8.5 1 5.5 5.5 0 0 0-8.5-1c-3 3-1 6.8 1 8.8L12 21l7.5-7.4c2-2 4-5.8 1-8.8Z" />,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    home: <><path d="m3 10 9-7 9 7M5 9v12h14V9m-10 12v-7h6v7" /></>,
  };
  return <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

export default function LoginExperience() {
  return (
    <section className="auth-hero login-experience" aria-labelledby="login-experience-title">
      <div className="login-brand"><img src={logo} alt="" width="44" height="44" /><span>Sewak<span className="login-brand-caption">Care, closer to home.</span></span></div>
      <div className="login-intro">
        <p className="login-eyebrow">A helping hand. A little peace of mind.</p>
        <h1 id="login-experience-title">Trusted care, when<br className="login-desktop-break" /> your family needs it.</h1>
        <p className="login-description">Find verified caregivers for children, adults, elderly family members and home care.</p>
      </div>
      <div className="login-visual">
        <img className="login-care-illustration" src={careIllustration} width="600" height="340" alt="A caregiver sharing a warm moment with an older woman and a child at home." />
        <div className="login-visual-note"><span><LoginIcon name="heart" /></span><div>Care that feels like home<small>For every generation.</small></div></div>
      </div>
      <ul className="login-trust" aria-label="The Sewak care experience">
        <li><LoginIcon name="shield" /><span>Verified<br />caregivers</span></li>
        <li><LoginIcon name="clock" /><span>Flexible hourly<br />&amp; shift booking</span></li>
        <li><LoginIcon name="home" /><span>Care designed for<br />Nepali families</span></li>
      </ul>
    </section>
  );
}
