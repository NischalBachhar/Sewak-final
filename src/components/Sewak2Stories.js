import React from 'react';
import { Link } from 'react-router-dom';
import './Sewak2Stories.css';

// Authentic, freely licensed photographs. These are illustrative only, not Sewak providers.
// Source and photographer credits: docs/SEWAK2_MEDIA_SOURCES.md
const moments = [
  {
    tag: 'Senior care',
    heading: 'Support that feels human.',
    description: 'Find local help for older parents and loved ones, on a schedule that suits your family.',
    href: '/browse?service=catalog_elderly_care',
    image: '/images/sewak2-senior-care.webp',
    alt: 'Caregiver supporting an older woman with a walking frame',
  },
  {
    tag: 'Child care',
    heading: 'A little help. More family time.',
    description: 'Explore childcare and family support from real Sewak profiles, all in one place.',
    href: '/browse?service=catalog_child_care_babysitting',
    image: '/images/sewak2-family-care.webp',
    alt: 'Mother reading a storybook with her daughter at home',
  },
  {
    tag: 'Home & daily support',
    heading: 'Life works better together.',
    description: 'From household help to flexible care, compare services, schedules and real rates.',
    href: '/browse?category=household',
    image: '/images/sewak2-care-team.webp',
    alt: 'Nurse smiling with an older adult in an indoor care setting',
  },
];
export default function Sewak2Stories() {
  return <section className="sewak2-stories" aria-labelledby="sewak2-stories-title">
    <header className="sewak2-stories__heading">
      <div><p className="sewak2-kicker">Care for the moments that matter</p>
        <h2 id="sewak2-stories-title">Your people. Your routine. <span className="sewak2-stories-accent">Your kind of care.</span></h2>
      </div>
      <p>Browse caregivers first, then discover different ways Sewak can help families across Nepal.</p>
    </header>
    <div className="sewak2-stories__grid">
      {moments.map(moment => <Link className="sewak2-story" to={moment.href} key={moment.tag}>
        <img src={moment.image} alt={moment.alt} loading="lazy" decoding="async" width="600" height="660" referrerPolicy="no-referrer" />
        <span className="sewak2-story__tag">{moment.tag}</span>
        <div className="sewak2-story__body">
          <h3>{moment.heading}</h3>
          <p>{moment.description}</p>
          <span className="sewak2-story__link">Find care <span aria-hidden="true">↗</span></span>
        </div>
      </Link>)}
    </div>
    <footer className="sewak2-stories__foot">
      <span>Find support that fits your family and your routine.</span>
      <a href="#services">Explore Services</a>
      <Link to="/get-started">Want to offer care? Join Sewak <span aria-hidden="true">→</span></Link>
    </footer>
  </section>;
}
