import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicHeader from './components/PublicHeader';
import { LoginIcon } from './components/LoginExperience';
import { loadServiceOptions } from './components/ServiceSelector';
import HomeServiceIcon from './components/HomeServiceIcon';
import './HomePage.css';
import HomeCaregiverMarketplace from './components/HomeCaregiverMarketplace';

export default function HomePage() {
  const [services, setServices] = useState([]);
  const [state, setState] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [showAllServices, setShowAllServices] = useState(false);
  const { hash } = useLocation();
  useEffect(() => {
    let active = true;
    setState('loading');
    loadServiceOptions().then(items => {
      if (active) { setServices(items.map(item => ({ ...item, category: item.category === 'vendor' ? 'household' : item.category }))); setState('ready'); }
    }).catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [attempt]);
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView();
  }, [hash, state]);
  return <div className="home-page">
    <PublicHeader />
    <main id="main-content">
      <HomeCaregiverMarketplace />
      <section className="home-hero home-hero--secondary" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <p className="home-eyebrow">People · Care · Everyday connection</p>
          <h2 id="home-title">Trusted care for <em>every stage of life.</em></h2>
          <p className="home-lead">Find trusted caregivers and household support for children, adults, elderly family members, and households across Nepal.</p>
          <div className="home-actions"><a className="home-button" href="#caregivers"><LoginIcon name="heart" />Find Care<LoginIcon name="arrow" /></a><a className="home-button home-button--outline" href="#services">Explore Services</a></div>
          <p className="home-hero__note">For your family. For your home. For a little peace of mind.</p>
        </div>
        <figure className="home-hero__visual"><img src="/images/care-for-every-generation.webp" width="1536" height="1024" loading="lazy" decoding="async" alt="Illustration of Nepali caregivers supporting a child, older family members and an adult wheelchair user, with household help at home." /><figcaption>Care, closer to home.</figcaption></figure>
      </section>
      <section id="services" className="home-section" aria-labelledby="services-title">
        <div className="home-section-heading"><div><p className="home-eyebrow">A helping hand, your way</p><h2 id="services-title">Support that fits your life.</h2></div><p>Explore Sewak’s current service catalog. Availability and pricing depend on the care professional you choose.</p></div>
        {state === 'loading' && <p className="home-catalog-state" role="status">Loading available services…</p>}
        {state === 'error' && <div className="home-catalog-state" role="alert"><p>We couldn’t load services right now.</p><button className="home-button home-button--outline" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
        {state === 'ready' && !services.length && <p className="home-catalog-state">There are no published services to show yet. Please check back soon.</p>}
        <div id="home-service-list" className="home-services">{(showAllServices ? services : services.slice(0, 6)).map(service => <article key={service.id} className="home-service"><span className="home-icon"><HomeServiceIcon service={service} /></span><p className="home-service__category">{service.category === 'household' ? 'Household support' : service.category === 'both' ? 'Care & household support' : 'Caregiver support'}</p><h3>{service.label || service.serviceName}</h3><Link to={"/?service=" + encodeURIComponent(service.id) + "#caregivers"} aria-label={`Find caregivers offering ${service.label || service.serviceName}`}>Explore caregivers <LoginIcon name="arrow" /></Link></article>)}</div>
        {services.length > 6 && <button className="home-button home-button--outline home-services-toggle" aria-expanded={showAllServices} aria-controls="home-service-list" onClick={() => setShowAllServices(value => !value)}>{showAllServices ? 'Show fewer services' : `View all ${services.length} services`}</button>}
      </section>
      <section id="how-it-works" className="home-how home-section" aria-labelledby="how-title">
        <div className="home-section-heading"><div><p className="home-eyebrow">A simpler way to arrange care</p><h2 id="how-title">A little help.<br /><em>A lot of possibility.</em></h2></div><p>Three steps from searching to arranging support.</p></div>
        <ol className="home-steps">{[['01', 'Find your care partner', 'Search by service and location to find someone who fits your needs.'], ['02', 'Request the support you need', 'Choose a service and schedule. Care is confirmed only after the caregiver accepts.'], ['03', 'Keep care in one place', 'Manage your bookings through your Sewak account.']].map(([number, title, copy]) => <li key={number}><span aria-hidden="true">{number}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol>
      </section>
      <section className="home-join home-section" aria-labelledby="join-title"><div><p className="home-eyebrow">Stronger homes. Connected communities.</p><h2 id="join-title">Find care. <em>Or help others find it.</em></h2><p>Explore support for your family. Organizations can select their role at signup and apply for review.</p><Link className="home-text-link" to="/auth">Already part of Sewak? Sign in</Link></div><div className="home-actions"><Link className="home-button" to="/browse">Find Care for My Family <LoginIcon name="arrow" /></Link><Link className="home-button home-button--outline" to="/auth?mode=register">Register My Organization <LoginIcon name="arrow" /></Link></div></section>
    </main>
    <footer className="home-footer"><Link className="home-footer__brand" to="/">Sewak</Link><p>Care for every stage of life. Across Nepal.</p><nav aria-label="Footer"><Link to="/browse">Find Care</Link><Link to="/auth?mode=register">Join Sewak</Link><a href="#how-it-works">How it works</a></nav></footer>
  </div>;
}
