import React, { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { hasVerifiedRating } from '../bookingModel';
import { formatNpr } from '../config/brand';
import { caregiverBookingReason } from '../caregiverDiscovery';
import { serviceFamily } from '../serviceCatalog';
import useSavedCare from '../useSavedCare';
import ProfileImage from './ProfileImage';
import RequestAvailability from './RequestAvailability';
import { VerificationBadge } from './CareExperience';

export default function CaregiverPreviewCard({ caregiver, services = [], onSelect, onViewProfile, requireLogin, compact = false }) {
  const navigate = useNavigate();
  const reason = caregiverBookingReason(caregiver);
  const reasonId = useId();
  const { saved, toggle, enabled } = useSavedCare();
  const initials = (caregiver.name || 'C').split(' ').map(part => part[0]).join('').slice(0, 2);
  const rating = hasVerifiedRating(caregiver) ? Number(caregiver.rating) : null;
  const serviceLabels = [...new Set((caregiver.servicesOffered || []).map(id => {
    const service = services.find(item => [item.id, item.label, item.serviceName].some(value => value?.toLowerCase() === String(id).toLowerCase()));
    return (serviceFamily(id) || serviceFamily(service?.label || service?.serviceName))?.[1] || service?.label || service?.serviceName || String(id).replace(/^catalog_/, '').replace(/_/g, ' ');
  }))];
  const viewProfile = () => onViewProfile?.(caregiver);
  const request = () => {
    if (reason) return;
    if (requireLogin) navigate('/caregivers/' + encodeURIComponent(caregiver.id) + '?request=1#request-care');
    else onSelect?.(caregiver);
  };
  return <article className={'care-listing-card' + (compact ? ' care-listing-card--compact' : '')}>
    <div className="care-listing-card__portrait">
      {caregiver.profileImage ? <ProfileImage src={caregiver.profileImage} alt={caregiver.name || 'Caregiver'} /> : <span>{initials}</span>}
    </div>
    <div className="care-listing-card__details">
      <div className="care-listing-card__title"><h3><button type="button" onClick={viewProfile}>{caregiver.name || 'Caregiver'}</button></h3>
        {enabled && <button type="button" className="care-save" aria-pressed={saved.includes(caregiver.id)} aria-label={(saved.includes(caregiver.id) ? 'Remove ' : 'Save ') + (caregiver.name || 'caregiver')} onClick={() => toggle(caregiver.id)}>{saved.includes(caregiver.id) ? '♥' : '♡'}</button>}
      </div>
      <p className="care-listing-card__location">{caregiver.location || 'Location not listed'}{caregiver.organizationName && <span> · {caregiver.organizationName}</span>}</p>
      <div className="care-listing-card__reputation">
        {rating === null ? <span>No verified reviews yet</span> : <span className="care-listing-card__rating" aria-label={`${rating.toFixed(1)} out of 5 stars`}><span aria-hidden="true">★</span> {rating.toFixed(1)} <small>({caregiver.reviewCount || 0} verified reviews)</small></span>}
        <VerificationBadge state={caregiver.verificationSource === 'audited_v1' && caregiver.verified ? 'verified' : 'not_verified'} label={caregiver.verificationSource === 'audited_v1' && caregiver.verified ? 'Verified' : 'Verification not complete'} compact />
      </div>
      <p className="care-listing-card__experience">{caregiver.experience ? `${caregiver.experience}+ years experience` : 'Experience not listed'}{caregiver.workType && <span> · {caregiver.workType === 'fulltime' ? 'Full time' : caregiver.workType === 'parttime' ? 'Part time' : 'Schedule to confirm'}</span>}{!compact && typeof caregiver.jobsCompleted === 'number' && <span> · {caregiver.jobsCompleted} completed sessions</span>}</p>
      <div className="care-listing-card__services" aria-label="Services offered">{serviceLabels.slice(0, 2).map(label => <span key={label}>{label}</span>)}{serviceLabels.length > 2 && <span>+{serviceLabels.length - 2} more</span>}{!serviceLabels.length && <span>Services not specified</span>}</div>
      <RequestAvailability caregiver={caregiver} />
    </div>
    <div className="care-listing-card__action">
      <p className="care-listing-card__price"><small>Starting at</small><strong>{Number.isFinite(caregiver.hourlyRate) && (caregiver.hourlyRate > 0 || caregiver.allowZeroRate) ? `${formatNpr(caregiver.hourlyRate)}/hour` : 'Rate not listed'}</strong></p>
      <button type="button" className="care-primary-button" onClick={request} disabled={Boolean(reason)} aria-describedby={reason ? reasonId : undefined}>Request availability <span aria-hidden="true">→</span></button>
      <button type="button" className="care-profile-link" onClick={viewProfile}>View profile</button>
    </div>
    {reason && <p id={reasonId} className="care-listing-card__reason">{reason}</p>}
  </article>;
}
