import React, { useEffect, useRef, useState } from 'react';

// Sewak-specific media. Supply an original/licensed MP4 via the build setting.
// The original Sewak illustration remains visible until the browser can render video.
const videoUrl = process.env.REACT_APP_SEWAK_HERO_VIDEO_URL || '';
// Images portray care generally; they are not actual Sewak caregiver profiles.
// Each photograph is identified and licensed in docs/SEWAK2_MEDIA_SOURCES.md.
const photos = {
  public: 'https://images.unsplash.com/photo-1773227055624-07b515ba87c5?auto=format&fit=crop&w=1400&q=82',
  user: 'https://images.unsplash.com/photo-1758598738003-3c2ea5c8b166?auto=format&fit=crop&w=1600&q=82',
  caregiver: 'https://images.unsplash.com/photo-1773227055624-07b515ba87c5?auto=format&fit=crop&w=1600&q=82',
  orgadmin: 'https://images.unsplash.com/photo-1765896387387-0538bc9f997e?auto=format&fit=crop&w=1600&q=82',
  superadmin: 'https://images.unsplash.com/photo-1765896387387-0538bc9f997e?auto=format&fit=crop&w=1600&q=82',
};

export function CareHeroMedia({ alt = '', className = '', photo = 'public' }) {
  const [canPlay, setCanPlay] = useState(false);
  const [paused, setPaused] = useState(false);
  const video=useRef(null);
  // Resolve the preference before mounting a video, avoiding a first-frame autoplay.
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {setReducedMotion(preference.matches);setPaused(false);};
    sync();
    preference.addEventListener?.('change', sync);
    return () => preference.removeEventListener?.('change', sync);
  }, []);
  return <div className={'sewak-care-media ' + className}>
    <img src={photos[photo] || photos.public} alt={alt} width="1536" height="1024" decoding="async"
      onError={event => { const fallback = '/images/care-for-every-generation.webp'; if (!event.currentTarget.src.endsWith(fallback)) event.currentTarget.src = fallback; }} />
    {videoUrl && !reducedMotion && <video
      aria-hidden="true" className={canPlay ? 'is-ready' : ''}
      ref={video}
      autoPlay muted loop playsInline preload="metadata" tabIndex={-1}
      onLoadedData={() => setCanPlay(true)} onError={() => setCanPlay(false)}
    ><source src={videoUrl} type="video/mp4" /></video>}
    {videoUrl&&!reducedMotion&&canPlay&&<button className="sewak-media-toggle" type="button"
      aria-label={paused?'Play background video':'Pause background video'} onClick={()=>{
        if(paused)video.current?.play().then(()=>setPaused(false)).catch(()=>setCanPlay(false));
        else {video.current?.pause();setPaused(true);}
      }}>{paused?'Play video':'Pause video'}</button>}
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
    <CareHeroMedia photo={role} />
    <div className="sewak-role-hero__body">
      <span>{detail.eyebrow}</span>
      <h2>{detail.heading}</h2>
      <a href={detail.href}>{detail.cta} <span aria-hidden="true">→</span></a>
    </div>
  </section>;
}
