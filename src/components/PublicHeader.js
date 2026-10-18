import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import logo from '../logoSewak.jpeg';
import './PublicHeader.css';

export default function PublicHeader() {
  return <header className="public-header">
    <a className="skip-link" href="#main-content">Skip to content</a>
    <div className="public-header__inner">
      <Link className="public-brand" to="/" aria-label="Sewak home">
        <img src={logo} alt="" width="46" height="46" />
        <span><strong>Sewak</strong><small>Care, closer to home.</small></span>
      </Link>
      <nav className="public-nav" aria-label="Public pages">
        <NavLink to="/" end>Home</NavLink>
        <NavLink to="/browse">Find Care</NavLink>
        <Link to="/#services">Our Services</Link>
        <Link to="/#how-it-works">How it works</Link>
      </nav>
      <div className="public-header__actions">
        <Link className="public-login" to="/auth">Sign in</Link>
        <Link className="public-signup" to="/auth?mode=register">Sign up</Link>
      </div>
    </div>
  </header>;
}
