import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import PublicHeader from './components/PublicHeader';
import HomeCaregiverMarketplace from './components/HomeCaregiverMarketplace';
import { loadServiceOptions } from './components/ServiceSelector';
import HomeServiceIcon from './components/HomeServiceIcon';
import './HomePage.css';

const categoryCards = [
  {key:'children',title:'Child care',glyph:'🧸',color:'peach',search:'child'},
  {key:'seniors',title:'Senior care',glyph:'🫶',color:'sage',search:'elderly'},
  {key:'adults',title:'Adult care',glyph:'💚',color:'lilac',search:'patient'},
  {key:'house',title:'Housekeeping',glyph:'🧹',color:'rose',search:'household'},
  {key:'support',title:'Disability support',glyph:'🤝',color:'blue',search:'disability'},
  {key:'all',title:'All services',glyph:'✨',color:'lemon',search:''},
];
const images = [
  {url:'https://images.pexels.com/photos/29372727/pexels-photo-29372727.jpeg?auto=compress&cs=tinysrgb&w=1800', credit:'Jsme MILA / Pexels', caption:'At-home support'},
  {url:'https://images.pexels.com/photos/8055794/pexels-photo-8055794.jpeg?auto=compress&cs=tinysrgb&w=1800', credit:'Annushka Ahuja / Pexels', caption:'Family moments'},
  {url:'https://images.pexels.com/photos/8307542/pexels-photo-8307542.jpeg?auto=compress&cs=tinysrgb&w=1800', credit:'Mikhail Nilov / Pexels', caption:'Every generation'},
];
const featureCards = [
  {title:'Discover local care',text:'Find caregivers and household helpers by service and location.',image:'https://images.pexels.com/photos/29372536/pexels-photo-29372536.jpeg?auto=compress&cs=tinysrgb&w=850',tone:'mint',cta:'Find caregivers'},
  {title:'Understand each profile',text:'Compare services, rates, availability, reviews and verification information.',image:'/images/care-for-every-generation.webp',tone:'sky',cta:'Compare care'},
  {title:'Request care with confidence',text:'Choose your schedule and send a request. Your caregiver confirms before care begins.',image:'https://images.pexels.com/photos/8055794/pexels-photo-8055794.jpeg?auto=compress&cs=tinysrgb&w=850',tone:'orange',cta:'How booking works'},
  {title:'Keep care organised',text:'See booking requests, acceptances and updates from your own account.',image:'https://images.pexels.com/photos/8307542/pexels-photo-8307542.jpeg?auto=compress&cs=tinysrgb&w=850',tone:'pink',cta:'Get started'},
];
const IconArrow = () => <span aria-hidden="true">→</span>;
export default function HomePage() {
  const [city,setCity]=useState('');
  const [searchCategory,setSearchCategory]=useState('caregiver');
  const [activeSlide,setActiveSlide]=useState(0);
  const [services,setServices]=useState([]);
  const [catalogState,setCatalogState]=useState('loading');
  const [catalogRetry,setCatalogRetry]=useState(0);
  const [showAllServices,setShowAllServices]=useState(false);
  const [motionAllowed,setMotionAllowed]=useState(true);
  const featuresRef=useRef(null);
  const navigate=useNavigate();
  const {hash}=useLocation();
  useEffect(() => {
    const mq=window.matchMedia('(prefers-reduced-motion: reduce)');
    setMotionAllowed(!mq.matches);
    const update=()=>setMotionAllowed(!mq.matches);
    mq.addEventListener?.('change',update);
    return ()=>mq.removeEventListener?.('change',update);
  },[]);
  useEffect(() => {
    if (!motionAllowed) return undefined;
    const timer=setInterval(()=>setActiveSlide(s=>(s+1)%images.length),6200);
    return ()=>clearInterval(timer);
  },[motionAllowed]);
  useEffect(() => {
    let active=true;
    setCatalogState('loading');
    loadServiceOptions().then(items=>{if(active){setServices(items);setCatalogState('ready');}}).catch(()=>{if(active)setCatalogState('error');});
    return ()=>{active=false;};
  },[catalogRetry]);
  useEffect(()=>{ if(hash) document.getElementById(hash.slice(1))?.scrollIntoView?.({block:'start'});},[hash,catalogState]);
  const startSearch=e=>{
    e.preventDefault();
    const params=new URLSearchParams();
    if(city.trim())params.set('location',city.trim().slice(0,160));
    if(searchCategory)params.set('category',searchCategory);
    navigate('/?'+params.toString()+'#caregivers');
    requestAnimationFrame(()=>document.getElementById('caregivers')?.scrollIntoView({behavior:motionAllowed?'smooth':'auto'}));
  };
  const categorySearch=card=>{
    if(card.key==='house')navigate('/?category=household#caregivers');
    else if(card.search)navigate('/?text='+encodeURIComponent(card.search)+'#caregivers');
    else navigate('/#caregivers');
  };
  const scrollFeatures=dir=>featuresRef.current?.scrollBy({left:dir*330,behavior:motionAllowed?'smooth':'auto'});
  return <div className="home-page sewak-reference-home">
    <PublicHeader/>
    <main id="main-content">
      <section className="sewak-cinematic-hero" aria-labelledby="sewak-hero-heading">
        <div className="sewak-hero-scenes" aria-hidden="true">
          {images.map((image,i)=><div key={image.url} className={'sewak-hero-scene'+(i===activeSlide?' is-active':'')} style={{backgroundImage:'url("'+image.url+'")'}} />)}
          <div className="sewak-hero-shade"/>
        </div>
        <div className="sewak-hero-content">
          <p className="sewak-hero-kicker">CARE, CLOSER TO HOME</p>
          <h1 id="sewak-hero-heading">Connecting families with <span>quality, local caregivers</span></h1>
          <p className="sewak-hero-subheading">Discover trusted support for your family and home, across Nepal.</p>
          <form className="sewak-hero-search" role="search" aria-label="Start finding care" onSubmit={startSearch}>
            <label><span>What kind of care?</span><select aria-label="Care category" value={searchCategory} onChange={e=>setSearchCategory(e.target.value)}>
              <option value="caregiver">Caregiver support</option><option value="household">Household help</option><option value="">All care & help</option>
            </select></label>
            <label className="sewak-hero-location"><span>Where?</span><input aria-label="City or locality" type="search" placeholder="City or locality (e.g. Kathmandu)" maxLength="160" value={city} onChange={e=>setCity(e.target.value)}/></label>
            <button type="submit">Find care <IconArrow/></button>
          </form>
          <div className="sewak-hero-facts" aria-label="How Sewak works">
            <div><strong>01</strong><span>Find local profiles</span></div>
            <div><strong>02</strong><span>Compare and request</span></div>
            <div><strong>03</strong><span>Caregiver confirms</span></div>
          </div>
        </div>
        <div className="sewak-hero-progress" aria-label="Care moments"><span>Care that matters, everywhere</span><div>{images.map((v,i)=><button key={v.url} type="button" aria-label={'Show care moment '+(i+1)} aria-current={activeSlide===i?'true':undefined} onClick={()=>setActiveSlide(i)} />)}</div></div>
      </section>
      <section className="sewak-category-area" aria-labelledby="sewak-categories-heading">
        <div className="sewak-section-head">
          <div><p className="sewak-kicker">EVERY KIND OF CARE</p><h2 id="sewak-categories-heading">What can we help with?</h2></div>
          <Link to="/browse">Explore all care <IconArrow/></Link>
        </div>
        <div className="sewak-category-grid">
          {categoryCards.map(card=><button type="button" key={card.key} className={'sewak-category-card sewak-category-card--'+card.color} onClick={()=>categorySearch(card)}>
            <span className="sewak-category-label">{card.title}<b aria-hidden="true">↗</b></span>
            <span className="sewak-category-art" aria-hidden="true">{card.glyph}</span>
          </button>)}
        </div>
      </section>
      <section className="sewak-feature-area" aria-labelledby="sewak-feature-heading">
        <div className="sewak-section-head sewak-section-head--center">
          <div><p className="sewak-kicker">A BETTER WAY TO FIND HELP</p><h2 id="sewak-feature-heading">Care that works around your life</h2></div>
        </div>
        <div className="sewak-feature-rail-wrap"><div className="sewak-feature-rail" ref={featuresRef}>
          {featureCards.map((f,i)=><article key={f.title} className={'sewak-feature-card sewak-feature-card--'+f.tone}>
            <div className="sewak-feature-media"><img src={f.image} alt="" loading="lazy" decoding="async"/></div>
            <div className="sewak-feature-copy"><span>0{i+1} / SIMPLE & PERSONAL</span><h3>{f.title}</h3><p>{f.text}</p><Link to={i===2?'/#how-it-works':i===3?'/auth?mode=register':'/#caregivers'}>{f.cta} <IconArrow/></Link></div>
          </article>)}
        </div>
        <div className="sewak-carousel-actions">
          <button type="button" onClick={()=>scrollFeatures(-1)} aria-label="Previous care benefits">‹</button>
          <button type="button" onClick={()=>scrollFeatures(1)} aria-label="Next care benefits">›</button>
        </div></div>
      </section>
      <div className="sewak-interest-strip" aria-label="Care for every stage of life">{['New parents','Child care','Elderly companions','Everyday home help','Patient support','Flexible shifts','Disability care','Trusted relationships'].map((label,i)=><span key={label}><span aria-hidden="true" className="sewak-interest-dot">{['◐','♡','✦','⌂'][i%4]}</span>{label}</span>)}</div>
      <HomeCaregiverMarketplace embedded/>
      <section className="sewak-trust-banner" aria-labelledby="sewak-trust-heading">
        <img loading="lazy" alt="Older adult receiving attentive support at home" src="https://images.pexels.com/photos/29372536/pexels-photo-29372536.jpeg?auto=compress&cs=tinysrgb&w=1600"/>
        <div><p className="sewak-kicker">MAKE INFORMED CHOICES</p><h2 id="sewak-trust-heading">Peace of mind starts with knowing who you hire.</h2><p>Explore each caregiver's services, verified review status and available checks before sending your request. Sewak never guarantees safety based on one badge.</p><Link to="/#how-it-works">How Sewak works <IconArrow/></Link></div>
      </section>
      <section id="how-it-works" className="sewak-process" aria-labelledby="sewak-process-heading">
        <div className="sewak-section-head sewak-section-head--center"><div><p className="sewak-kicker">CARE WITHOUT THE CONFUSION</p><h2 id="sewak-process-heading">How Sewak works</h2></div></div>
        <div className="sewak-process-grid">
          {[['01','Explore people','Filter caregivers by service, location and rate. Open real profiles and compare details.'],['02','Send a care request','Select the help and schedule you need. Your booking request is sent to the caregiver.'],['03','Get confirmation','Track acceptance and care updates from your Sewak account. No request is confirmed until accepted.']].map(([no,title,copy])=><article key={no}><span>{no}</span><h3>{title}</h3><p>{copy}</p></article>)}
        </div>
        <Link to="/browse" className="sewak-pill sewak-pill--green">Start searching <IconArrow/></Link>
      </section>
      <section id="services" className="sewak-service-section" aria-labelledby="sewak-services-title">
        <div className="sewak-section-head"><div><p className="sewak-kicker">DISCOVER OUR SERVICES</p><h2 id="sewak-services-title">Support for every kind of day</h2></div><Link to="/browse">View all caregivers <IconArrow/></Link></div>
        {catalogState==='loading'&&<p role="status">Loading Sewak services…</p>}
        {catalogState==='error'&&<p role="alert">We couldn't load the current service catalog. <button type="button" onClick={()=>setCatalogRetry(v=>v+1)}>Retry</button></p>}
        {catalogState==='ready'&&services.length===0&&<p>No services have been published yet.</p>}
        <div className="sewak-service-grid">
          {(showAllServices?services:services.slice(0,8)).map(service=><Link key={service.id} to={'/?service='+encodeURIComponent(service.id)+'#caregivers'} className="sewak-service-link"><span className="sewak-service-icon"><HomeServiceIcon service={service}/></span><span>{service.label||service.serviceName}</span><IconArrow/></Link>)}
        </div>
        {services.length>8&&<button type="button" className="sewak-service-more" aria-expanded={showAllServices} onClick={()=>setShowAllServices(v=>!v)}>{showAllServices?'Show fewer services':'See all '+services.length+' services'} <IconArrow/></button>}
      </section>
      <section className="sewak-join-banner" aria-labelledby="sewak-join-heading"><div><p className="sewak-kicker">GOOD CARE BUILDS STRONG COMMUNITIES</p><h2 id="sewak-join-heading">Make more room for what matters.</h2><p>Families can find care. Care organizations can bring their teams to Sewak.</p></div><div><Link className="sewak-pill sewak-pill--lime" to="/auth?mode=register">Get started <IconArrow/></Link><Link className="sewak-join-small-link" to="/auth">Already have an account? Log in</Link></div></section>
    </main>
    <footer className="sewak-footer">
      <div className="sewak-footer-inner">
        <div className="sewak-footer-brand"><strong>Sewak<span>.care</span></strong><p>Care, closer to home.</p><small>Find local caregiving and household support across Nepal.</small></div>
        <div><h3>Explore</h3><Link to="/browse">Find care</Link><Link to="/#caregivers">Caregivers</Link><Link to="/#services">Care services</Link><Link to="/#how-it-works">How it works</Link></div>
        <div><h3>For members</h3><Link to="/auth">Log in</Link><Link to="/auth?mode=register">Create an account</Link><Link to="/auth?mode=register">Join as an organization</Link><Link to="/browse">Search support</Link></div>
        <div><h3>About</h3><p>Made for families and care providers in Nepal.</p><small>Bookings require caregiver confirmation. Review profile and safety details before hiring.</small></div>
      </div>
      <div className="sewak-footer-base"><span>© {new Date().getFullYear()} Sewak. Care, closer to home.</span><span>Built for Nepal <span aria-hidden="true">♡</span></span></div>
    </footer>
  </div>;
}
