import React, { useEffect, useRef, useState } from "react";
import { collection, documentId, getDocs, query, where } from "firebase/firestore";
import { calculateQuote, kathmanduDate, validateBooking } from "./bookingValidation";
import { clearAttempt, createCashBooking, recoverBooking } from "./bookingService";
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

const joinLabels = (labels) => {
  if (labels.length < 2) return labels[0] || "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
};

const MAX_CARE_NEEDS_LENGTH = 1000 - `Requested time windows: ${joinLabels(
  TIME_WINDOW_OPTIONS.map((option) => option.label),
)}.\n\n`.length;

export default function BookingFormPage({ caregiver, onBooked }) {
  const { user, userDoc } = useAuth();
  const [step, setStep] = useState(0);
  const [careRecipient, setCareRecipient] = useState("");
  const [serviceId, setServiceId] = useState(caregiver?.servicesOffered?.[0] || "");
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

  const [offeredServices, setOfferedServices] = useState([]);
  const [confirmedQuote, setConfirmedQuote] = useState(null);
  const submittingRef = useRef(false);
  const [recovering, setRecovering] = useState(false);
  useEffect(() => {
    let active = true;
    const ids = caregiver?.servicesOffered?.slice(0, 20) || [];
    if (!ids.length) { setOfferedServices([]); return undefined; }
    getDocs(query(collection(db, "publicServices"), where(documentId(), "in", ids))).then((snapshot) => {
      if (active) setOfferedServices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
        .filter((item) => item.isActive !== false && caregiver?.servicesOffered?.includes(item.id)));
    }).catch(() => { if (active) setError("Services could not be loaded. Refresh to try again."); });
    return () => { active = false; };
  }, [caregiver?.id, caregiver?.servicesOffered]);
  const serviceLabel = (id) => offeredServices.find((item) => item.id === id)?.label || id;
  const input = { careRecipient: careRecipient.trim(), serviceId, serviceLabel: serviceLabel(serviceId),
    careNeeds: careNeeds.trim(), date, time, requestedTimeWindows, durationHours: Number(durationHours),
    recurrence, userName: fullName.trim(), userPhone: phone.trim(), address: address.trim(), city: city.trim(), notes: notes.trim() };
  const showValidation = (issue) => {
    setError(issue.message); setStep(issue.step);
    requestAnimationFrame(() => document.getElementById(issue.field)?.focus());
  };
  const checkPreviousRequest = async () => {
    setRecovering(true); setError("");
    try {
      const existing = await recoverBooking(user.uid, caregiver.id);
      if (existing) setSuccessBooking(existing);
      else { clearAttempt(user.uid, caregiver.id); setError("No previous request was saved. You can now confirm these details as a new attempt."); }
    } catch { setError("We could not check the previous request. Reconnect and check again before starting another."); }
    finally { setRecovering(false); }
  };
  const isPartTimeCaregiver = ["parttime", "part_time"].includes(serviceKey(caregiver?.workType));
  const requestedTimeWindowLabels = TIME_WINDOW_OPTIONS
    .filter((option) => requestedTimeWindows.includes(option.id))
    .map((option) => option.label);
  let displayQuote;
  try { displayQuote = confirmedQuote || calculateQuote(caregiver || {}, durationHours); } catch { displayQuote = null; }
  const hourlyRate = displayQuote?.hourlyRate;
  const totalAmount = displayQuote?.totalAmount;

  if (!caregiver) {
    return <ErrorState title="Caregiver not selected" description="Choose a caregiver before starting a booking." />;
  }

  const toggleRequestedTimeWindow = (timeWindow) => {
    setRequestedTimeWindows((current) =>
      current.includes(timeWindow)
        ? current.filter((item) => item !== timeWindow)
        : [...current, timeWindow],
    );
  };

  const nextStep = () => {
    const issue = validateBooking(input, caregiver).find((item) => item.step <= step);
    if (issue) { showValidation(issue); return; }
    setError(""); setStep((current) => Math.min(current + 1, 3));
  };
  const submitBooking = async (event) => {
    event.preventDefault();
    if (step !== STEP_COPY.length - 1) { nextStep(); return; }
    if (submittingRef.current) return;
    const issue = validateBooking(input, caregiver)[0];
    if (issue) { showValidation(issue); return; }
    if (!user) { setError("Please sign in before requesting care."); return; }
    submittingRef.current = true; setSubmitting(true); setError("");
    try {
      const result = await createCashBooking({ user, caregiver, input, confirmedQuote: displayQuote });
      if (result.changedQuote) {
        setConfirmedQuote(result.changedQuote);
        setError("The quote changed. Review the updated total and commission below, then confirm again to save.");
      } else setSuccessBooking(result);
    } catch (submitError) {
      setError(submitError.code === "permission-denied"
        ? "The caregiver, service, safety status or price changed. Refresh their listing and review the request again."
        : submitError.message || "We could not confirm the result. Check the previous request before retrying.");
    } finally { submittingRef.current = false; setSubmitting(false); }
  };

  if (successBooking) {
    return (
      <section className="booking-form-success" aria-live="polite">
        <span className="booking-form-success__mark" aria-hidden="true">✓</span>
        <p className="booking-form-eyebrow">Care request submitted</p>
        <h2>Your request is with {successBooking.caregiverName}.</h2>
        <p>Check My bookings for the caregiver’s response. Booking #{successBooking.id.slice(-8)}.</p>
        <button type="button" className="btn btn-primary" onClick={() => onBooked?.(successBooking.id)}>
          View booking
        </button>
        <button type="button" className="btn btn-outline" onClick={() => { clearAttempt(user.uid, caregiver.id); setSuccessBooking(null); setStep(0); }}>Start a separate booking</button>
      </section>
    );
  }

  return (
    <form className="booking-form" noValidate onSubmit={submitBooking} onChange={() => setConfirmedQuote(null)}>
      <BookingStepper
        steps={STEP_COPY}
        currentStep={step}
        completedSteps={STEP_COPY.slice(0, step).map((item) => item.id)}
        onStepChange={(_, index) => setStep(index)}
        heading="Book care with confidence"
        description="Review each detail before you send the request."
      />

      {error ? <div className="error-message" role="alert">{error}</div> : null}
      <button type="button" className="link-button" disabled={recovering || submitting} onClick={checkPreviousRequest}>{recovering ? "Checking…" : "Check previous request / recover attempt"}</button>

      <section className="booking-form-panel" hidden={step !== 0}>
        <p className="booking-form-eyebrow">Step 1</p>
        <h2>Who needs care?</h2>
        <p>Share the basics so the caregiver understands the request before accepting it.</p>
        <label htmlFor="care-recipient">Person needing care *</label>
        <input id="care-recipient" value={careRecipient} onChange={(event) => setCareRecipient(event.target.value)} placeholder="For example, my parent or child" maxLength={120} />
        <label htmlFor="care-service">Care or support needed</label>
        <select id="care-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
          <option value="">Choose an offered service</option>
          {offeredServices.map((service) => <option key={service.id} value={service.id}>{service.label || service.serviceName}</option>)}
        </select>
        <label htmlFor="care-needs">What help is required?</label>
        <textarea id="care-needs" value={careNeeds} onChange={(event) => setCareNeeds(event.target.value)} maxLength={MAX_CARE_NEEDS_LENGTH} placeholder="For example, mobility support, meal assistance, companionship, or important needs." />
      </section>

      <section className="booking-form-panel" hidden={step !== 1}>
        <p className="booking-form-eyebrow">Step 2</p>
        <h2>When is care needed?</h2>
        <p>Choose a schedule that the caregiver can review before accepting.</p>
        <div className="booking-form-grid">
          <label>Date *<input id="booking-date" type="date" value={date} min={kathmanduDate()} onChange={(event) => setDate(event.target.value)} /></label>
          <label>{isPartTimeCaregiver ? "Preferred start time" : "Start time *"}<input id="booking-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
          <label>Duration (hours) *<input id="booking-duration" type="number" min="1" max="24" value={durationHours} onChange={(event) => setDurationHours(event.target.value)} /></label>
          <label>Frequency<select id="booking-recurrence" value={recurrence} onChange={(event) => setRecurrence(event.target.value)}><option value="one_time">One-time care</option><option value="recurring">Recurring care (confirm with caregiver)</option></select></label>
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
          <label>Contact name *<input id="booking-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} maxLength={120} /></label>
          <label>Phone *<input id="booking-phone" autoComplete="tel" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={40} /></label>
          <label className="booking-form-grid__wide">Address *<input id="booking-address" autoComplete="street-address" value={address} onChange={(event) => setAddress(event.target.value)} maxLength={300} /></label>
          <label>City *<input id="booking-city" autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} maxLength={100} /></label>
          <label className="booking-form-grid__wide">Additional instructions<textarea id="booking-notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1500} placeholder="Anything the caregiver should know before accepting." /></label>
        </div>
      </section>

      <section className="booking-form-panel" hidden={step !== 3}>
        <p className="booking-form-eyebrow">Step 4</p>
        <h2>Review and confirm</h2>
        <dl className="booking-form-review">
          <div><dt>Caregiver</dt><dd>{caregiver.name || "Caregiver"}</dd></div>
          <div><dt>Care needed</dt><dd>{serviceLabel(serviceId)}</dd></div>
          {requestedTimeWindowLabels.length ? <div><dt>Preferred windows</dt><dd>{joinLabels(requestedTimeWindowLabels)}</dd></div> : null}
          <div><dt>Schedule</dt><dd>{date || "—"} {time ? `at ${time}` : ""} · {durationHours || 0} hours</dd></div>
          <div><dt>Location</dt><dd>{address || "—"}{city ? `, ${city}` : ""}</dd></div>
          <div><dt>Price</dt><dd>{hourlyRate !== undefined ? `${formatNpr(hourlyRate)}/hr` : "Rate to be confirmed"}</dd></div>
          <div><dt>Commission included</dt><dd>{displayQuote?.commissionRate ?? "—"}%</dd></div>
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
        {step < STEP_COPY.length - 1 ? <button key="continue" type="button" className="btn btn-primary" onClick={nextStep}>Continue</button> : <button key="confirm" type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? "Sending request…" : "Confirm booking"}</button>}
      </div>
    </form>
  );
}
