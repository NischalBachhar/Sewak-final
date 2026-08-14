import React, { useMemo, useState } from "react";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { useAuth } from "./AuthContext";
import { formatNpr } from "./config/brand";
import { BookingStepper, ErrorState } from "./components/CareExperience";
import "./BookingFormPage.css";

const STEP_COPY = [
  { id: "care", label: "Care needed", shortLabel: "Care needed", description: "Who needs support?" },
  { id: "schedule", label: "Schedule", shortLabel: "Schedule", description: "When is care needed?" },
  { id: "details", label: "Details", shortLabel: "Details", description: "Contact and instructions" },
  { id: "review", label: "Review", shortLabel: "Review", description: "Confirm your request" },
];

const CARE_SERVICE_OPTIONS = [
  { id: "general_care", label: "General care support" },
  { id: "child_care", label: "Child care" },
  { id: "elder_care", label: "Elder care" },
  { id: "adult_care", label: "Adult care" },
  { id: "post_operation_care", label: "Post-operation care" },
  { id: "post_pregnancy_care", label: "Post-pregnancy care" },
  { id: "pre_pregnancy_care", label: "Pre-pregnancy care" },
];

const HOUSEHOLD_SERVICE_OPTIONS = [
  { id: "room_cleaning", label: "Room cleaning" },
  { id: "cooking", label: "Cooking" },
  { id: "laundry", label: "Laundry" },
  { id: "dish_washing", label: "Dish washing" },
];

const BOOKING_SERVICE_OPTIONS = [...CARE_SERVICE_OPTIONS, ...HOUSEHOLD_SERVICE_OPTIONS];

const TIME_WINDOW_OPTIONS = [
  { id: "morning", label: "Morning" },
  { id: "day", label: "Day" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
];

const serviceKey = (service) => String(service || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "_")
  .replace(/^_+|_+$/g, "");

const serviceLabel = (service) =>
  BOOKING_SERVICE_OPTIONS.find((option) => option.id === serviceKey(service))?.label ||
  String(service || "General care support").replace(/_/g, " ");

const joinLabels = (labels) => {
  if (labels.length < 2) return labels[0] || "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
};

const MAX_CARE_NEEDS_LENGTH = 1000 - `Requested time windows: ${joinLabels(
  TIME_WINDOW_OPTIONS.map((option) => option.label),
)}.\n\n`.length;

const localDateKey = (value = new Date()) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function BookingFormPage({ caregiver, onBooked }) {
  const { user, userDoc } = useAuth();
  const [step, setStep] = useState(0);
  const [careRecipient, setCareRecipient] = useState("");
  const [serviceId, setServiceId] = useState("general_care");
  const [careNeeds, setCareNeeds] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [requestedTimeWindows, setRequestedTimeWindows] = useState([]);
  const [durationHours, setDurationHours] = useState(4);
  const [recurrence, setRecurrence] = useState("one_time");
  const [fullName, setFullName] = useState(userDoc?.name || "");
  const [phone, setPhone] = useState(userDoc?.phone || "");
  const [address, setAddress] = useState(userDoc?.address || "");
  const [city, setCity] = useState(userDoc?.city || "");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successBooking, setSuccessBooking] = useState(null);

  const offeredServices = useMemo(() => {
    const knownServices = new Set(BOOKING_SERVICE_OPTIONS.map((option) => option.id));
    const seen = new Set();

    return (caregiver?.servicesOffered || []).filter((service) => {
      const key = serviceKey(service);
      if (!key || knownServices.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [caregiver]);
  const isPartTimeCaregiver = ["parttime", "part_time"].includes(serviceKey(caregiver?.workType));
  const requestedTimeWindowLabels = TIME_WINDOW_OPTIONS
    .filter((option) => requestedTimeWindows.includes(option.id))
    .map((option) => option.label);
  const requestedTimeWindowNote = requestedTimeWindowLabels.length
    ? `Requested time windows: ${joinLabels(requestedTimeWindowLabels)}.`
    : "";
  const hourlyRate = Number(caregiver?.hourlyRate || 0);
  const totalAmount = Math.max(0, Number(durationHours || 0) * hourlyRate);

  if (!caregiver) {
    return <ErrorState title="Caregiver not selected" description="Choose a caregiver before starting a booking." />;
  }

  const validateCurrentStep = () => {
    if (step === 0 && !careRecipient.trim()) return "Tell us who needs care before continuing.";
    if (step === 1 && (!date || !Number(durationHours) || (!time && (!isPartTimeCaregiver || requestedTimeWindows.length === 0)))) {
      return isPartTimeCaregiver
        ? "Add the date and duration, then choose a start time or at least one preferred time window."
        : "Add the date, start time, and duration for care.";
    }
    if (step === 1 && date < localDateKey()) return "Choose today or a future date for care.";
    if (step === 2 && (!fullName.trim() || !phone.trim() || !address.trim() || !city.trim())) return "Add your contact and location details before continuing.";
    return "";
  };

  const toggleRequestedTimeWindow = (timeWindow) => {
    setRequestedTimeWindows((current) =>
      current.includes(timeWindow)
        ? current.filter((item) => item !== timeWindow)
        : [...current, timeWindow],
    );
  };

  const nextStep = () => {
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, STEP_COPY.length - 1));
  };

  const buildBookingData = async (paymentStatus, paymentRefId = "") => {
    const caregiverSnapshot = await getDoc(doc(db, "publicCaregivers", caregiver.id));
    if (!caregiverSnapshot.exists()) throw new Error("This caregiver is no longer available.");
    const verifiedCaregiver = { id: caregiverSnapshot.id, ...caregiverSnapshot.data() };
    if (!verifiedCaregiver.isApproved || verifiedCaregiver.isSuspended || verifiedCaregiver.isBlacklisted || !verifiedCaregiver.isOrganizationActive || !verifiedCaregiver.isAvailable) {
      throw new Error("This caregiver is not available for new bookings right now.");
    }

    const verifiedRate = Number(verifiedCaregiver.hourlyRate || 0);
    const verifiedTotal = Number(durationHours) * verifiedRate;
    const verifiedCommission = verifiedTotal * 0.15;

    return {
      userId: user.uid,
      userName: fullName.trim(),
      userPhone: phone.trim(),
      userEmail: user.email || "",
      address: address.trim(),
      city: city.trim(),
      date,
      time,
      durationHours: Number(durationHours),
      recurrence,
      notes: notes.trim(),
      careRecipient: careRecipient.trim(),
      careNeeds: [requestedTimeWindowNote, careNeeds.trim()].filter(Boolean).join("\n\n"),
      serviceId: serviceId || "general_care",
      serviceLabel: serviceLabel(serviceId || "general_care"),
      caregiverId: verifiedCaregiver.id,
      vendorId: verifiedCaregiver.id,
      organizationId: verifiedCaregiver.organizationId || "",
      organizationName: verifiedCaregiver.organizationName || "",
      caregiverName: verifiedCaregiver.name || "Caregiver",
      caregiverLocation: verifiedCaregiver.location || "",
      caregiverWorkType: verifiedCaregiver.workType || "",
      caregiverShifts: verifiedCaregiver.shifts || [],
      caregiverCategory: verifiedCaregiver.category || "caregiver",
      status: "pending",
      hourlyRate: verifiedRate,
      totalAmount: verifiedTotal,
      platformCommission: verifiedCommission,
      vendorEarnings: verifiedTotal - verifiedCommission,
      paymentMethod,
      paymentStatus,
      amountDue: verifiedTotal,
      ...(paymentRefId ? { paymentRefId } : {}),
      createdAt: serverTimestamp(),
    };
  };

  const submitBooking = async (event) => {
    event.preventDefault();
    setError("");
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!user) {
      setError("Please sign in before requesting care.");
      return;
    }

    setSubmitting(true);
    try {
      const bookingData = await buildBookingData("pending");
      const bookingReference = await addDoc(collection(db, "bookings"), bookingData);
      setSuccessBooking({ id: bookingReference.id, ...bookingData });
    } catch (submitError) {
      setError(submitError.message || "We could not create this booking. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (successBooking) {
    return (
      <section className="booking-form-success" aria-live="polite">
        <span className="booking-form-success__mark" aria-hidden="true">✓</span>
        <p className="booking-form-eyebrow">Care request submitted</p>
        <h2>Your request is with {successBooking.caregiverName}.</h2>
        <p>We will notify you when the caregiver accepts. Booking #{successBooking.id.slice(0, 8)}.</p>
        <button type="button" className="btn btn-primary" onClick={() => onBooked?.(successBooking.id)}>
          View booking
        </button>
      </section>
    );
  }

  return (
    <form className="booking-form" onSubmit={submitBooking}>
      <BookingStepper
        steps={STEP_COPY}
        currentStep={step}
        completedSteps={STEP_COPY.slice(0, step).map((item) => item.id)}
        onStepChange={(_, index) => setStep(index)}
        heading="Book care with confidence"
        description="Review each detail before you send the request."
      />

      {error ? <div className="error-message" role="alert">{error}</div> : null}

      <section className="booking-form-panel" hidden={step !== 0}>
        <p className="booking-form-eyebrow">Step 1</p>
        <h2>Who needs care?</h2>
        <p>Share the basics so the caregiver understands the request before accepting it.</p>
        <label htmlFor="care-recipient">Person needing care *</label>
        <input id="care-recipient" value={careRecipient} onChange={(event) => setCareRecipient(event.target.value)} placeholder="For example, my parent or child" maxLength={120} />
        <label htmlFor="care-service">Care or support needed</label>
        <select id="care-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
          <optgroup label="Care services">
            {CARE_SERVICE_OPTIONS.map((service) => <option key={service.id} value={service.id}>{service.label}</option>)}
          </optgroup>
          <optgroup label="Household services">
            {HOUSEHOLD_SERVICE_OPTIONS.map((service) => <option key={service.id} value={service.id}>{service.label}</option>)}
          </optgroup>
          {offeredServices.length ? (
            <optgroup label="Other services this caregiver offers">
              {offeredServices.map((service) => <option key={service} value={service}>{serviceLabel(service)}</option>)}
            </optgroup>
          ) : null}
        </select>
        <label htmlFor="care-needs">What help is required?</label>
        <textarea id="care-needs" value={careNeeds} onChange={(event) => setCareNeeds(event.target.value)} maxLength={MAX_CARE_NEEDS_LENGTH} placeholder="For example, mobility support, meal assistance, companionship, or important needs." />
      </section>

      <section className="booking-form-panel" hidden={step !== 1}>
        <p className="booking-form-eyebrow">Step 2</p>
        <h2>When is care needed?</h2>
        <p>Choose a schedule that the caregiver can review before accepting.</p>
        <div className="booking-form-grid">
          <label>Date *<input type="date" value={date} min={localDateKey()} onChange={(event) => setDate(event.target.value)} /></label>
          <label>{isPartTimeCaregiver ? "Preferred start time" : "Start time *"}<input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
          <label>Duration (hours) *<input type="number" min="1" max="24" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} /></label>
          <label>Frequency<select value={recurrence} onChange={(event) => setRecurrence(event.target.value)}><option value="one_time">One-time care</option><option value="recurring">Recurring care (confirm with caregiver)</option></select></label>
        </div>
        {isPartTimeCaregiver ? (
          <fieldset className="booking-form-payment" aria-describedby="preferred-time-windows-help">
            <legend>Preferred time windows</legend>
            <p id="preferred-time-windows-help">Select every window that works for you. You can choose morning and night without selecting day; the caregiver confirms availability before accepting.</p>
            <div>
              {TIME_WINDOW_OPTIONS.map((timeWindow) => (
                <label key={timeWindow.id}>
                  <input type="checkbox" checked={requestedTimeWindows.includes(timeWindow.id)} onChange={() => toggleRequestedTimeWindow(timeWindow.id)} />
                  {timeWindow.label}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
      </section>

      <section className="booking-form-panel" hidden={step !== 2}>
        <p className="booking-form-eyebrow">Step 3</p>
        <h2>Booking details</h2>
        <p>Your contact and address are shared only with the caregiver assigned to this booking.</p>
        <div className="booking-form-grid">
          <label>Contact name *<input value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} /></label>
          <label>Phone *<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} /></label>
          <label className="booking-form-grid__wide">Address *<input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} /></label>
          <label>City *<input value={city} onChange={(event) => setCity(event.target.value)} maxLength={100} /></label>
          <label className="booking-form-grid__wide">Additional instructions<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1500} placeholder="Anything the caregiver should know before accepting." /></label>
        </div>
      </section>

      <section className="booking-form-panel" hidden={step !== 3}>
        <p className="booking-form-eyebrow">Step 4</p>
        <h2>Review and confirm</h2>
        <dl className="booking-form-review">
          <div><dt>Caregiver</dt><dd>{caregiver.name || "Caregiver"}</dd></div>
          <div><dt>Care needed</dt><dd>{serviceLabel(serviceId || "general_care")}</dd></div>
          {requestedTimeWindowLabels.length ? <div><dt>Preferred windows</dt><dd>{joinLabels(requestedTimeWindowLabels)}</dd></div> : null}
          <div><dt>Schedule</dt><dd>{date || "—"} {time ? `at ${time}` : ""} · {durationHours || 0} hours</dd></div>
          <div><dt>Location</dt><dd>{address || "—"}{city ? `, ${city}` : ""}</dd></div>
          <div><dt>Price</dt><dd>{hourlyRate ? `${formatNpr(hourlyRate)}/hr` : "Rate to be confirmed"}</dd></div>
          <div><dt>Total</dt><dd>{formatNpr(totalAmount, "Rate to be confirmed")}</dd></div>
        </dl>
        <fieldset className="booking-form-payment">
          <legend>Payment method</legend>
          <label><input type="radio" checked={paymentMethod === "cash"} onChange={() => setPaymentMethod("cash")} /> Pay cash to the caregiver</label>
          <p>Digital payments will appear here after secure, server-side provider verification is configured.</p>
        </fieldset>
        <p className="booking-form-cancellation">Cancellation: requests can be cancelled while they are waiting for the caregiver. Contact support for help with accepted or active care.</p>
      </section>

      <div className="booking-form-actions">
        {step > 0 ? <button type="button" className="btn btn-outline" onClick={() => { setError(""); setStep((current) => current - 1); }}>Back</button> : <span />}
        {step < STEP_COPY.length - 1 ? <button type="button" className="btn btn-primary" onClick={nextStep}>Continue</button> : <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Sending request…" : "Confirm booking"}</button>}
      </div>
    </form>
  );
}
