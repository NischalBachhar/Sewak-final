import React, { useEffect, useState } from 'react';

// Sewak-specific media. Supply an original/licensed MP4 via the build setting.
// The original Sewak illustration remains visible until the browser can render video.
const videoUrl = process.env.REACT_APP_SEWAK_HERO_VIDEO_URL || '';

export function CareHeroMedia({ alt = '', className = '' }) {
  const [canPlay, setCanPlay] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(preference.matches);
    sync();
    preference.addEventListener?.('change', sync);
    return () => preference.removeEventListener?.('change', sync);
  }, []);
  return <div className={'sewak-care-media ' + className}>
    <img src="/images/care-for-every-generation.webp" alt={alt} width="1536" height="1024" decoding="async" />
    {videoUrl && !reducedMotion && <video
      aria-hidden="true" className={canPlay ? 'is-ready' : ''}
      autoPlay muted loop playsInline preload="metadata" tabIndex={-1}
      onLoadedData={() => setCanPlay(true)} onError={() => setCanPlay(false)}
    ><source src={videoUrl} type="video/mp4" /></video>}
  </div>;
}

const variants = {
  user: { eyebrow: 'CARE, CLOSE TO HOME', heading: 'Find care that feels right.', cta: 'Find caregivers', href: '/user' },
  caregiver: { eyebrow: 'YOUR CARE COMMUNITY', heading: 'Find work that makes a difference.', cta: 'Explore opportunities', href: '/caregiver/opportunities' },
  orgadmin: { eyebrow: 'CONNECTED CARE TEAMS', heading: 'Better support begins with your team.', cta: 'Manage caregivers', href: '/organization?tab=caregivers' },
  superadmin: { eyebrow: 'SEWAK OPERATIONS', heading: 'Help every care connection feel safer.', cta: 'Review caregivers', href: '/superadmin/caregivers' },
};

export function RoleCareHero({ role }) {
  const detail = variants[role];
  if (!detail) return null;
  return <section className={'sewak-role-hero sewak-role-hero--' + role} aria-label="Sewak care">
    <CareHeroMedia />
    <div className="sewak-role-hero__body">
      <span>{detail.eyebrow}</span>
      <h2>{detail.heading}</h2>
      <a href={detail.href}>{detail.cta} <span aria-hidden="true">→</span></a>
    </div>
  </section>;
}
