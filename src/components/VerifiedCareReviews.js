import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, db, getDocs, limit, query } from '../d1Client';

export default function VerifiedCareReviews() {
  const [reviews, setReviews] = useState([]);
  useEffect(() => {
    let active = true;
    getDocs(query(collection(db, 'publicReviews'), limit(6))).then(snapshot => {
      if (active) setReviews(snapshot.docs.map(doc => ({id:doc.id,...doc.data()})).filter(review => review.isVerifiedReview === true && Number(review.rating) >= 1 && Number(review.rating) <= 5 && typeof review.comment === 'string' && review.comment.trim()).slice(0,3));
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  if (!reviews.length) return null;
  return <section className="care-reviews" aria-labelledby="care-reviews-title"><div className="marketplace-section-heading"><div><p className="care-eyebrow">After the care, their words.</p><h2 id="care-reviews-title">Feedback from completed bookings.</h2></div></div><div className="care-review-grid">{reviews.map(review => <article key={review.id}><p className="care-review-rating" aria-label={`${review.rating} out of 5 stars`}>★ {review.rating}/5</p><blockquote>{review.comment.length > 220 ? review.comment.slice(0,220) + '…' : review.comment}</blockquote><span>Verified customer</span><Link to={'/caregivers/' + encodeURIComponent(review.caregiverId)}>View caregiver →</Link></article>)}</div></section>;
}
