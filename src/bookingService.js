import { doc, getDocFromServer, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { calculateQuote, canonicalCategory, normalizePhone, scheduleBoundary, validateBooking } from "./bookingValidation";

const attemptKey = (uid, caregiverId) => `sewak.bookingAttempt.v1:${uid}:${caregiverId}`;
export const readAttempt = (uid, caregiverId) => {
  try { return JSON.parse(localStorage.getItem(attemptKey(uid, caregiverId)) || "null"); } catch { return null; }
};
export const clearAttempt = (uid, caregiverId) => localStorage.removeItem(attemptKey(uid, caregiverId));
export async function recoverBooking(uid, caregiverId) {
  const attempt = readAttempt(uid, caregiverId);
  if (!attempt) return null;
  const snapshot = await getDocFromServer(doc(db, "bookings", attempt.id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}
export async function fingerprint(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
async function createCashBookingUnlocked({ user, caregiver, input, confirmedQuote }) {
  const hash = await fingerprint({ userId: user.uid, caregiverId: caregiver.id, ...input, userPhone: normalizePhone(input.userPhone) });
  let attempt = readAttempt(user.uid, caregiver.id);
  if (attempt && attempt.fingerprint !== hash) {
    throw new Error("This attempt has different details. Check the previous request before starting a new one.");
  }
  if (attempt) {
    const saved = await recoverBooking(user.uid, caregiver.id);
    if (saved) return saved;
  }
  const errors = validateBooking(input, caregiver);
  if (errors.length) throw new Error(errors[0].message);
  const snapshot = await getDocFromServer(doc(db, "publicCaregivers", caregiver.id));
  if (!snapshot.exists()) throw new Error("This caregiver is no longer available.");
  const current = snapshot.data();
  const quote = calculateQuote(current, input.durationHours);
  if (JSON.stringify(quote) !== JSON.stringify(confirmedQuote)) return { changedQuote: quote };
  // Rules recheck PRIVATE caregiver/organization/service records at commit time.
  // This read is only for quote presentation, never authorization.
  const payload = {
    ...input, userId: user.uid, userEmail: user.email || "", userPhone: normalizePhone(input.userPhone),
    durationHours: Number(input.durationHours), caregiverId: caregiver.id, vendorId: caregiver.id,
    organizationId: current.organizationId || "", organizationName: current.organizationName || "",
    caregiverName: current.name || "Caregiver", caregiverLocation: current.location || "",
    caregiverWorkType: current.workType || "", caregiverShifts: current.shifts || [],
    caregiverCategory: canonicalCategory(current.category || "caregiver"), ...quote,
    status: "pending", paymentMethod: "cash", paymentStatus: "pending", schemaVersion: 2,
  };
  if (!attempt) {
    // Another submission may have created the durable attempt while the quote
    // was being fetched. Reuse it before considering a new ID.
    attempt = readAttempt(user.uid, caregiver.id);
  }
  if (attempt && attempt.fingerprint !== hash) throw new Error("This attempt has different details. Check the previous request first.");
  if (!attempt) {
    attempt = { id: `${user.uid}_${crypto.randomUUID()}`, fingerprint: hash };
    // Only opaque ID and digest are stored. Never persist care/contact payloads.
    localStorage.setItem(attemptKey(user.uid, caregiver.id), JSON.stringify(attempt));
  }
  const ref = doc(db, "bookings", attempt.id);
  return runTransaction(db, async (transaction) => {
    const existing = await transaction.get(ref);
    if (existing.exists()) {
      if (existing.data().requestFingerprint !== hash) throw new Error("This attempt has different details.");
      return { id: ref.id, ...existing.data() };
    }
    const booking = { ...payload, requestFingerprint: hash, scheduleAt: Timestamp.fromDate(scheduleBoundary(input)), createdAt: serverTimestamp() };
    transaction.set(ref, booking);
    return { id: ref.id, ...booking };
  });
}

const pending = new Map();
export function createCashBooking(args) {
  const key = attemptKey(args.user.uid, args.caregiver.id);
  const work = () => createCashBookingUnlocked(args);
  // Web Locks serialize tabs; the promise queue also covers duplicate events
  // in environments without Web Locks. Neither stores care details on disk.
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(key, work);
  const result = (pending.get(key) || Promise.resolve()).catch(() => {}).then(work);
  pending.set(key, result);
  result.finally(() => { if (pending.get(key) === result) pending.delete(key); }).catch(() => {});
  return result;
}
