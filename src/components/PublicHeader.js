import React, { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import logo from '../assets/sewak-care-mark.svg';
import './PublicHeader.css';

export default function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="public-header">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <div className="public-header__inner">
        <Link className="public-brand" to="/" aria-label="Sewak home" onClick={() => setMenuOpen(false)}>
          <img src={logo} alt="" width="46" height="46" />
          <span><strong>Sewak</strong><small>Care, closer to home.</small></span>
        </Link>
        <nav id="public-navigation" className={'public-nav' + (menuOpen ? ' is-open' : '')} aria-label="Public pages" onClick={() => setMenuOpen(false)}>
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/browse">Find care</NavLink>
          <Link to="/care-services">Care services</Link>
          <Link to="/safety">Safety</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/get-started">For care partners</Link>
        </nav>
        <div className="public-header__actions">
          <Link className="public-login" to="/auth">Log in</Link>
          <Link className="public-signup" to="/get-started">Get started <span aria-hidden="true">→</span></Link>
          <button className="public-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-controls="public-navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
