import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/sewak-care-mark.svg';
import './PublicHeader.css';

const menus = {
  care: {
    title: 'Find the right support',
    categories: [
      ['Child care', 'Babysitting', 'Daytime and after-school care'],
      ['Senior care', 'Elderly care', 'Companionship and daily assistance'],
      ['Adult care', 'Patient and disability support', 'Help for recovery and everyday life'],
      ['Housekeeping', 'Household help', 'Reliable support around the home'],
    ],
    links: [['Search caregivers','/#caregivers'],['All care services','/#services'],['How Sewak works','/#how-it-works']],
  },
  work: {
    title: 'Care opportunities',
    categories: [
      ['Caregiver profiles', 'Build your care profile', 'Share skills, availability and experience'],
      ['Agency partnership', 'Join as an organization', 'Bring your care professionals to Sewak'],
    ],
    links: [['Register an organization','/auth?mode=register'],['Learn how it works','/#how-it-works']],
  },
  resources: {
    title: 'Helpful information',
    categories: [
      ['Get started', 'How booking works', 'Search, request and confirm care'],
      ['Trust & safety', 'Verification and reviews', 'Understand profile checks before hiring'],
    ],
    links: [['Find care','/browse'],['Our care services','/#services'],['Sign in','/auth']],
  },
};

function JoinDialog({ onClose, onChoose }) {
  const firstButton = useRef(null);
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    firstButton.current?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = [...document.querySelectorAll('.sewak-join-dialog button')];
        if (!focusable.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previouslyFocused?.focus?.(); };
  }, [onClose]);
  return <div className="sewak-join-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="sewak-join-dialog" role="dialog" aria-modal="true" aria-labelledby="sewak-join-title" aria-describedby="sewak-join-description">
      <button ref={firstButton} className="sewak-join-close" type="button" aria-label="Close sign-up choices" onClick={onClose}>×</button>
      <p className="sewak-join-eyebrow">WELCOME TO SEWAK</p>
      <h2 id="sewak-join-title">What brings you here?</h2>
      <p id="sewak-join-description">Choose how you'd like to get started.</p>
      <div className="sewak-join-options">
        <button type="button" onClick={() => onChoose('user')}>
          <span className="sewak-join-illustration" aria-hidden="true">♡</span>
          <strong>Find care</strong><small>Find a caregiver or household support</small>
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" onClick={() => onChoose('orgadmin')}>
          <span className="sewak-join-illustration sewak-join-illustration--org" aria-hidden="true">⌂</span>
          <strong>Provide care</strong><small>Join as a caregiver organization</small>
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <p className="sewak-join-small">Individual caregivers currently onboard through registered organizations.</p>
      <p className="sewak-join-signin">Already have an account? <Link to="/auth" onClick={onClose}>Log in</Link></p>
    </section>
  </div>;
}

export default function PublicHeader() {
  const [activeMenu, setActiveMenu] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const headerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    setActiveMenu(null);
    setMobileOpen(false);
  }, [location.pathname, location.search, location.hash]);
  useEffect(() => {
    const close = e => { if (!headerRef.current?.contains(e.target)) setActiveMenu(null); };
    const esc = e => { if (e.key === 'Escape') { setActiveMenu(null); setMobileOpen(false); } };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, []);
  const joinAs = role => {
    sessionStorage.setItem('sewak.registrationRole', role);
    setShowJoin(false);
    navigate('/auth?mode=register');
  };
  const menuButton = (key,label) => <div className="sewak-nav-holder" key={key} onMouseEnter={() => { if (window.matchMedia('(min-width: 961px)').matches) setActiveMenu(key); }} onMouseLeave={() => { if (window.matchMedia('(min-width: 961px)').matches) setActiveMenu(null); }}>
    <button type="button" className={'sewak-nav-trigger' + (activeMenu === key ? ' is-active' : '')}
      aria-expanded={activeMenu === key} aria-controls={'sewak-menu-' + key} onClick={() => setActiveMenu(activeMenu === key ? null : key)}>
      {label}<span className="sewak-chevron" aria-hidden="true">⌄</span>
    </button>
    {activeMenu === key && <div className="sewak-mega" id={'sewak-menu-' + key} role="group" aria-label={label + ' menu'}>
      <div className="sewak-mega-main"><p>{menus[key].title}</p>
        {menus[key].categories.map(([section,title,description]) =>
          <Link to={key === 'care' ? '/#caregivers' : key === 'work' ? '/auth?mode=register' : '/#how-it-works'} key={title} onClick={() => setActiveMenu(null)}>
            <small>{section}</small><strong>{title}</strong><span>{description}</span>
          </Link>)}
      </div>
      <div className="sewak-mega-aside"><p>Explore Sewak</p>{menus[key].links.map(([label,url]) => <Link key={label} to={url} onClick={() => setActiveMenu(null)}>{label}<span aria-hidden="true">↗</span></Link>)}</div>
    </div>}
  </div>;
  return <>
    <header ref={headerRef} className="public-header sewak-public-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="public-header__inner">
        <Link className="public-brand" to="/" aria-label="Sewak home">
          <img src={logo} alt="" width="39" height="39"/><strong>Sewak<span>.care</span></strong>
        </Link>
        <nav className={'sewak-primary-nav' + (mobileOpen ? ' is-open' : '')} aria-label="Public navigation">
          {menuButton('care','Find care')}
          {menuButton('work','Find work')}
          <button type="button" className="sewak-nav-trigger" onClick={() => joinAs('orgadmin')}>List your organization</button>
          {menuButton('resources','Resources')}
          <Link className="sewak-mobile-login" to="/auth">Log in</Link>
        </nav>
        <div className="public-header__actions">
          <Link className="public-login" to="/auth">Log in</Link>
          <button className="public-signup" type="button" onClick={() => setShowJoin(true)}>Join now</button>
          <button type="button" className="public-menu-toggle" aria-expanded={mobileOpen} aria-label={mobileOpen ? 'Close menu' : 'Open menu'} onClick={() => setMobileOpen(s => !s)}>
            <span/><span/><span/>
          </button>
        </div>
      </div>
    </header>
    {showJoin && <JoinDialog onClose={() => setShowJoin(false)} onChoose={joinAs} />}
  </>;
}
