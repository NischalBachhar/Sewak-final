import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import PublicHeader from './components/PublicHeader';
import { LoginIcon } from './components/LoginExperience';
import { loadServiceOptions } from './components/ServiceSelector';
import './HomePage.css';

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
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <p className="home-eyebrow">People · Care · Everyday connection</p>
          <h1 id="home-title">Trusted care for <em>every stage of life.</em></h1>
          <p className="home-lead">Find trusted caregivers and household support for children, adults, elderly family members, and households across Nepal.</p>
          <div className="home-actions"><Link className="home-button" to="/browse"><LoginIcon name="heart" />Find Care<LoginIcon name="arrow" /></Link><a className="home-button home-button--outline" href="#services">Explore Services</a></div>
          <p className="home-hero__note">For your family. For your home. For a little peace of mind.</p>
        </div>
        <figure className="home-hero__visual"><img src="/images/care-for-every-generation.webp" width="1536" height="1024" fetchPriority="high" alt="Illustration of Nepali caregivers supporting a child, older family members and an adult wheelchair user, with household help at home." /><figcaption>Care, closer to home.</figcaption></figure>
      </section>
      <div className="home-values" aria-label="Care with Sewak">
        {[['heart', 'Every generation', 'Support for children, adults and older people.'], ['home', 'Everyday help', 'Care and household support in one place.'], ['shield', 'Informed choices', 'Review profile and verification details.'], ['clock', 'Your care, together', 'Keep track of requests and care updates.']].map(([icon, title, copy]) => <div key={title}><span className="home-icon"><LoginIcon name={icon} /></span><div><strong>{title}</strong><p>{copy}</p></div></div>)}
      </div>
      <section id="services" className="home-section" aria-labelledby="services-title">
        <div className="home-section-heading"><div><p className="home-eyebrow">A helping hand, your way</p><h2 id="services-title">Support that fits your life.</h2></div><p>Explore Sewak’s current service catalog. Availability and pricing depend on the care professional you choose.</p></div>
        {state === 'loading' && <p className="home-catalog-state" role="status">Loading available services…</p>}
        {state === 'error' && <div className="home-catalog-state" role="alert"><p>We couldn’t load services right now.</p><button className="home-button home-button--outline" onClick={() => setAttempt(value => value + 1)}>Try again</button></div>}
        {state === 'ready' && !services.length && <p className="home-catalog-state">There are no published services to show yet. Please check back soon.</p>}
        <div id="home-service-list" className="home-services">{(showAllServices ? services : services.slice(0, 6)).map(service => <article key={service.id} className="home-service"><span className="home-icon"><LoginIcon name={service.category === 'household' ? 'home' : 'heart'} /></span><p className="home-service__category">{service.category === 'household' ? 'Household support' : service.category === 'both' ? 'Care & household support' : 'Caregiver support'}</p><h3>{service.label || service.serviceName}</h3><Link to="/browse" aria-label={`Find care for ${service.label || service.serviceName}`}>Explore caregivers <span aria-hidden="true">→</span></Link></article>)}</div>
        {services.length > 6 && <button className="home-button home-button--outline home-services-toggle" aria-expanded={showAllServices} aria-controls="home-service-list" onClick={() => setShowAllServices(value => !value)}>{showAllServices ? 'Show fewer services' : `View all ${services.length} services`}</button>}
      </section>
      <section id="how-it-works" className="home-how home-section" aria-labelledby="how-title">
        <div className="home-section-heading"><div><p className="home-eyebrow">A simpler way to arrange care</p><h2 id="how-title">A little help.<br /><em>A lot of possibility.</em></h2></div><p>From finding the right person to keeping up with care, take each step with clarity.</p></div>
        <div className="home-steps">{[['01', 'Find your care partner', 'Browse services, locations and caregiver profiles. Check experience, pricing and verification details.'], ['02', 'Request the support you need', 'Choose your service and schedule. Your request waits for caregiver acceptance before care is confirmed.'], ['03', 'Keep care in one place', 'Follow booking updates and manage your care through your Sewak account.']].map(([number, title, copy]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>
      <section className="home-section home-confidence" aria-labelledby="confidence-title">
        <div><p className="home-eyebrow">Confidence starts with clarity</p><h2 id="confidence-title">Personal care.<br /><em>Thoughtful choices.</em></h2><p>Care is personal. Take time to review each professional’s services and credentials, and choose support that fits your needs.</p><Link className="home-button home-button--outline" to="/browse">Meet care professionals <LoginIcon name="arrow" /></Link></div>
        <div className="home-confidence__cards"><article><LoginIcon name="shield" /><div><h3>Check the details</h3><p>Verification status is shown on individual profiles. Review it before requesting care.</p></div></article><article><LoginIcon name="heart" /><div><h3>Make an informed decision</h3><p>Read available feedback, compare service information and review the booking summary before submitting.</p></div></article><article><LoginIcon name="home" /><div><h3>Understand the next step</h3><p>Track whether your request is pending, accepted, in progress or completed from your account.</p></div></article></div>
      </section>
      <section className="home-join home-section" aria-labelledby="join-title"><div><p className="home-eyebrow">Stronger homes. Connected communities.</p><h2 id="join-title">There’s a place for you here.</h2><p>Find support for your family, or register your organization to offer care through Sewak’s application review process.</p></div><div className="home-actions"><Link className="home-button" to="/auth?mode=register">Create an account <LoginIcon name="arrow" /></Link><Link className="home-text-link" to="/auth">Already part of Sewak? Sign in</Link></div></section>
    </main>
    <footer className="home-footer"><Link className="home-footer__brand" to="/">Sewak</Link><p>Care for every stage of life. Across Nepal.</p><nav aria-label="Footer"><Link to="/browse">Find Care</Link><Link to="/auth?mode=register">Join Sewak</Link><a href="#how-it-works">How it works</a></nav></footer>
  </div>;
}
