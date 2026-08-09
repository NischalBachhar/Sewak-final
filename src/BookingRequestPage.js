import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import { db } from "./firebaseConfig";
import BookingFormPage from "./BookingFormPage";
import { ErrorState, SkeletonCard } from "./components/CareExperience";

export default function BookingRequestPage() {
  const { caregiverId } = useParams();
  const navigate = useNavigate();
  const [caregiver, setCaregiver] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCaregiver() {
      try {
        const snapshot = await getDoc(doc(db, "publicCaregivers", caregiverId));
        if (!snapshot.exists()) throw new Error("This caregiver profile is not available.");
        const profile = { id: snapshot.id, ...snapshot.data() };
        if (!profile.isApproved || profile.isSuspended || profile.isBlacklisted || !profile.isOrganizationActive || !profile.isAvailable) throw new Error("This caregiver is not available for new bookings.");
        if (active) setCaregiver(profile);
      } catch (loadError) {
        if (active) setError(loadError.message || "We could not load this caregiver.");
      }
    }
    if (caregiverId) loadCaregiver();
    return () => { active = false; };
  }, [caregiverId]);

  if (error) return <ErrorState title="Booking unavailable" description={error} actionLabel="Browse caregivers" onAction={() => navigate("/user")} />;
  if (!caregiver) return <div className="booking-request-loading" aria-busy="true"><SkeletonCard /></div>;

  return (
    <div className="booking-request-page">
      <button type="button" className="booking-request-page__back" onClick={() => navigate(`/user/caregivers/${caregiver.id}`)}>Back to caregiver profile</button>
      <BookingFormPage caregiver={caregiver} onBooked={(bookingId) => navigate(`/user/bookings/${bookingId}`)} />
    </div>
  );
}
