import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PublicHeader from './components/PublicHeader';
import PublicFooter from './components/PublicFooter';
import CareCategoryTiles from './components/CareCategoryTiles';
import { publicServiceChoices } from './serviceCatalog';
import { loadPublicCareServices } from './caregiverDiscovery';
import './MarketplaceExpansion.css';

function Intro({ eyebrow, title, children }) {
  return <header className="care-info-intro"><p>{eyebrow}</p><h1>{title}</h1><div className="care-info-lead">{children}</div></header>;
}
function ActualServices() {
  const [state, setState] = useState({ loading: true, services: [], error: '' });
  const [all, setAll] = useState(false);
  useEffect(() => {
    let active = true;
    loadPublicCareServices().then(services => { if (active) setState({ loading: false, services: publicServiceChoices(services), error: '' }); })
      .catch(() => { if (active) setState({ loading: false, services: [], error: 'Service listings could not be loaded.' }); });
    return () => { active = false; };
  }, []);
  return <section className="care-info-services" aria-labelledby="actual-services-heading">
    <div className="care-info-section-heading"><div><span>WAYS WE CAN HELP</span><h2 id="actual-services-heading">Explore available services</h2></div><Link to="/browse">Browse all care professionals →</Link></div>
    {state.loading ? <p role="status">Loading Sewak services…</p> : state.error ? <p role="alert">{state.error}</p> : !state.services.length ? <p>No services are currently published. Check again soon.</p> :
      <div className="care-info-service-grid">{(all ? state.services : state.services.slice(0, 12)).map(service =>
        <Link key={service.id} to={'/browse?service=' + encodeURIComponent(service.id)} className="care-info-service">
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
        <Intro eyebrow="WELCOME TO SEWAK" title="What brings you to Sewak?"><p>Care is personal. Start with the path that fits what you need.</p></Intro>
        <div className="care-info-choice-grid">
            <article><span className="care-info-choice-icon" aria-hidden="true">♡</span><h2>I'm looking for care</h2><p>Explore trusted local profiles, compare availability and hourly rates, and send a booking request.</p><Link to="/browse">Find care <span aria-hidden="true">→</span></Link><Link to="/auth?mode=register&role=user">Create a family account <span aria-hidden="true">→</span></Link></article>
          <article><span className="care-info-choice-icon" aria-hidden="true">✳</span><h2>I manage a care organization</h2><p>Register your agency or service business. Your application is reviewed before your team is published.</p><Link to="/auth?mode=register&role=orgadmin">Register organization <span aria-hidden="true">→</span></Link></article>
          <article><span className="care-info-choice-icon" aria-hidden="true">⌂</span><h2>I'm a caregiver</h2><p>Apply as an independent care professional. Complete your profile and wait for Sewak approval before accepting bookings.</p><Link to="/auth?mode=register&role=caregiver">Apply as a caregiver <span aria-hidden="true">→</span></Link></article>
        </div>
      </>}
      {page === 'services' && <>
        <Intro eyebrow="CARE THAT FITS YOUR FAMILY" title="Explore care and household support."><p>Choose a type of help and compare real published care professionals near you. Availability varies by service and city.</p></Intro>
        <CareCategoryTiles descriptions />
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
          <article><span className="care-info-choice-icon" aria-hidden="true">✓</span><h2>Pay in cash</h2><p>Check the total before sending a request. Cash is the current payment method; there is no paid membership to browse care.</p><Link to="/auth?mode=register&role=user">Create a family account →</Link></article>
        </div>
      </>}
      {page === 'pricing' && <section className="care-faq" aria-labelledby="pricing-faq"><h2 id="pricing-faq">A clearer picture of care costs.</h2><details><summary>How much will my booking cost?</summary><p>Each profile shows a starting hourly rate in NPR. Your request shows a quote based on your selected hours. Review the final total and terms before submitting.</p></details><details><summary>Does a request confirm my caregiver?</summary><p>No. Your caregiver needs to accept the request. Discuss the duties, schedule and payment arrangements before care begins.</p></details><details><summary>Do I need a paid membership?</summary><p>No paid membership is currently required to browse Sewak or send a cash booking request. An account is needed to manage requests.</p></details></section>}
      {page === 'safety' && <section className="care-faq" aria-labelledby="safety-faq"><h2 id="safety-faq">Before your first care visit.</h2><details><summary>What does a verification badge mean?</summary><p>A badge describes the specific records reviewed by Sewak. Open the caregiver’s verification details to see which checks are complete. It does not guarantee suitability or replace your interview and reference checks.</p></details><details><summary>How do I raise a concern?</summary><p>Open the relevant booking in your account and use its issue/report option where available. Share the booking reference with your organization contact. Caregivers can also use Report a user from their workspace.</p><Link to="/auth">Sign in to manage a booking →</Link></details></section>}
      <section className="care-info-end"><div><p>CARE, CLOSE TO HOME</p><h2>Ready to find a helping hand?</h2></div><Link to="/browse">Explore caregivers <span aria-hidden="true">→</span></Link></section>
    </main>
    <PublicFooter />
  </div>;
}
