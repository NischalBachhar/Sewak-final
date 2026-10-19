import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from './components/PublicHeader';
import { loadPublicCareServices } from './caregiverDiscovery';
import './MarketplaceExpansion.css';

const categories = [
  { name: 'Child & family care', terms: ['child', 'baby', 'babysit', 'nanny'], icon: '♡', description: 'Support for little ones and the people who care for them.' },
  { name: 'Older adult care', terms: ['elder', 'senior', 'old age', 'aged'], icon: '✳', description: 'Find thoughtful help for parents and older family members.' },
  { name: 'Everyday assistance', terms: ['patient', 'disabil', 'personal', 'companion'], icon: '☼', description: 'Practical assistance with daily routines and companionship.' },
  { name: 'Home & household', terms: ['house', 'clean', 'cook', 'maid', 'domestic', 'helper'], icon: '⌂', description: 'Help with everyday work around the home.' },
];
function Intro({ eyebrow, title, children }) {
  return <header className="care-info-intro"><p>{eyebrow}</p><h1>{title}</h1><div className="care-info-lead">{children}</div></header>;
}
function ActualServices() {
  const [state, setState] = useState({ loading: true, services: [], error: '' });
  const [all, setAll] = useState(false);
  useEffect(() => {
    let active = true;
    loadPublicCareServices().then(services => { if (active) setState({ loading: false, services, error: '' }); })
      .catch(() => { if (active) setState({ loading: false, services: [], error: 'Service listings could not be loaded.' }); });
    return () => { active = false; };
  }, []);
  return <section className="care-info-services" aria-labelledby="actual-services-heading">
    <div className="care-info-section-heading"><div><span>LIVE SERVICE CATALOG</span><h2 id="actual-services-heading">Explore available services</h2></div><Link to="/browse">Browse all care professionals →</Link></div>
    {state.loading ? <p role="status">Loading Sewak services…</p> : state.error ? <p role="alert">{state.error}</p> : !state.services.length ? <p>No services are currently published. Check again soon.</p> :
      <div className="care-info-service-grid">{(all ? state.services : state.services.slice(0, 12)).map(service =>
        <Link key={service.id} to={'/?service=' + encodeURIComponent(service.id) + '#caregivers'} className="care-info-service">
          <span>{service.category === 'household' || service.category === 'vendor' ? 'HOUSEHOLD HELP' : 'CARE SUPPORT'}</span>
          <strong>{service.label || service.serviceName}</strong>
          <small>Explore caregivers offering this service →</small>
        </Link>)}</div>}
    {state.services.length > 12 && <button type="button" className="care-info-more" onClick={() => setAll(v => !v)}>{all ? 'Show fewer services' : 'Show all services'}</button>}
  </section>;
}
export default function CareInfoPage({ page = 'start', withHeader = true }) {
  return <div className="care-info-page">{withHeader && <PublicHeader />}
    <main id="main-content" className="care-info-main">
      {page === 'start' && <>
        <Intro eyebrow="WELCOME TO SEWAK" title="Let’s find your next step."><p>Care is personal. Start with the path that fits what you need.</p></Intro>
        <div className="care-info-choice-grid">
            <article><span className="care-info-choice-icon" aria-hidden="true">♡</span><h2>I'm looking for care</h2><p>Explore trusted local profiles, compare availability and hourly rates, and send a booking request.</p><Link to="/browse">Find care <span aria-hidden="true">→</span></Link><Link to="/auth?mode=register&role=user">Create a family account <span aria-hidden="true">→</span></Link></article>
          <article><span className="care-info-choice-icon" aria-hidden="true">✳</span><h2>I manage a care organization</h2><p>Register your agency or service business. Your application is reviewed before your team is published.</p><Link to="/auth?mode=register&role=orgadmin">Register organization <span aria-hidden="true">→</span></Link></article>
          <article><span className="care-info-choice-icon" aria-hidden="true">⌂</span><h2>I'm a caregiver</h2><p>Apply as an independent care professional. Complete your profile and wait for Sewak approval before accepting bookings.</p><Link to="/auth?mode=register&role=caregiver">Apply as a caregiver <span aria-hidden="true">→</span></Link></article>
        </div>
      </>}
      {page === 'services' && <>
        <Intro eyebrow="CARE THAT FITS YOUR FAMILY" title="Explore care and household support."><p>Choose a type of help and compare real published care professionals near you. Availability varies by service and city.</p></Intro>
        <div className="care-info-categories">{categories.map(c => <article key={c.name}><span aria-hidden="true">{c.icon}</span><h2>{c.name}</h2><p>{c.description}</p><Link to="/browse">Find available profiles →</Link></article>)}</div>
        <ActualServices />
      </>}
      {page === 'safety' && <>
        <Intro eyebrow="YOUR SAFETY MATTERS" title="Make thoughtful, informed care choices."><p>Sewak helps families review profile details and verification records. A profile badge is not a guarantee of safety or suitability; meet, assess and agree on expectations before hiring.</p></Intro>
        <div className="care-info-steps">
          <article><span>01</span><h2>Look at verification details</h2><p>Only checks approved in Sewak's verification workflow are presented as verified. Missing or pending records are displayed as incomplete.</p></article>
          <article><span>02</span><h2>Ask practical questions</h2><p>Discuss experience, languages, shift expectations, pay and care duties with a prospective caregiver.</p></article>
          <article><span>03</span><h2>Agree on a safe start</h2><p>Confirm the schedule, care plan, contact information and emergency arrangements before the first visit.</p></article>
          <article><span>04</span><h2>Use care and reporting tools</h2><p>Manage requests in Sewak and use the available reporting and support paths if something concerns you.</p></article>
        </div>
        <div className="care-info-disclaimer"><strong>A verification badge is not an employment reference or professional medical license.</strong><p>Where specialized clinical care is required, confirm the person's current legal qualifications and your local requirements independently.</p></div>
      </>}
      {page === 'pricing' && <>
        <Intro eyebrow="CLEAR CARE COSTS" title="Understand prices before requesting care."><p>Hourly rates are listed by individual professionals or organizations, when configured. Compare visible starting rates and confirm the final terms before a booking is accepted.</p></Intro>
        <div className="care-info-choice-grid">
          <article><span className="care-info-choice-icon" aria-hidden="true">₨</span><h2>Compare starting rates</h2><p>Browse profiles with real published NPR prices and service information. Unlisted rates are labeled clearly.</p><Link to="/browse">See caregiver rates →</Link></article>
          <article><span className="care-info-choice-icon" aria-hidden="true">◷</span><h2>Request the schedule you need</h2><p>One-time and recurring arrangements can be requested. Care begins only after caregiver acceptance.</p><Link to="/browse">Find a schedule →</Link></article>
          <article><span className="care-info-choice-icon" aria-hidden="true">✓</span><h2>Pay using supported methods</h2><p>Sewak currently supports cash booking requests. Online payment and paid membership features are not enabled. Registered families can preview plan concepts without charges.</p><Link to="/auth?mode=register">Explore free membership →</Link></article>
        </div>
      </>}
      <section className="care-info-end"><div><p>CARE, CLOSE TO HOME</p><h2>Ready to find a helping hand?</h2></div><Link to="/browse">Explore caregivers <span aria-hidden="true">→</span></Link></section>
    </main>
    <footer className="care-info-footer"><Link to="/">Sewak</Link><nav aria-label="Footer"><Link to="/care-services">Services</Link><Link to="/safety">Safety</Link><Link to="/pricing">Pricing</Link><Link to="/auth">Log in</Link></nav><small>Care arrangements require caregiver confirmation.</small></footer>
  </div>;
}
