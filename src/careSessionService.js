import {
  addDoc,
  collection,
  deleteField,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import { normalizeBooking } from "./bookingModel";

const sessionRefFor = (bookingId) => doc(db, "careSessions", bookingId);

export async function startCareSession({ booking, caregiverId }) {
  const normalized = normalizeBooking(booking);
  if (!normalized.id || !caregiverId) throw new Error("A booking and caregiver are required.");

  const batch = writeBatch(db);
  const sessionRef = sessionRefFor(normalized.id);
  const bookingRef = doc(db, "bookings", normalized.id);

  batch.set(sessionRef, {
    bookingId: normalized.id,
    caregiverId,
    customerId: normalized.userId,
    organizationId: normalized.organizationId || "",
    scheduledDate: normalized.date || "",
    scheduledTime: normalized.time || "",
    scheduledDurationHours: normalized.durationHours || 0,
    status: "in_progress",
    actualCheckIn: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(bookingRef, {
    status: "in_progress",
    careSessionId: normalized.id,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}

export async function finishCareSession({ bookingId }) {
  if (!bookingId) throw new Error("A booking is required.");

  const batch = writeBatch(db);
  batch.update(sessionRefFor(bookingId), {
    status: "completed",
    actualCheckOut: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.update(doc(db, "bookings", bookingId), {
    status: "completed",
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function addCareTask({ bookingId, caregiverId, label }) {
  const cleanLabel = String(label || "").trim();
  if (!bookingId || !caregiverId || !cleanLabel) {
    throw new Error("Add a short task description before saving.");
  }

  return addDoc(collection(sessionRefFor(bookingId), "tasks"), {
    label: cleanLabel.slice(0, 120),
    status: "pending",
    createdBy: caregiverId,
    createdAt: serverTimestamp(),
  });
}

export async function completeCareTask({ bookingId, taskId, caregiverId, completed }) {
  if (!bookingId || !taskId || !caregiverId) throw new Error("A care task is required.");
  await updateDoc(doc(sessionRefFor(bookingId), "tasks", taskId), {
    status: completed ? "completed" : "pending",
    completedAt: completed ? serverTimestamp() : deleteField(),
    completedBy: completed ? caregiverId : deleteField(),
  });
}

export async function addCareUpdate({ bookingId, caregiverId, message, type = "note" }) {
  const cleanMessage = String(message || "").trim();
  if (!bookingId || !caregiverId || !cleanMessage) {
    throw new Error("Write a short care update before sharing it.");
  }

  return addDoc(collection(sessionRefFor(bookingId), "updates"), {
    caregiverId,
    type: type === "milestone" ? "milestone" : "note",
    message: cleanMessage.slice(0, 500),
    createdAt: serverTimestamp(),
  });
}

export async function submitVerifiedReview({ booking, userId, rating, comment }) {
  const normalized = normalizeBooking(booking);
  const numericRating = Number(rating);
  const cleanComment = String(comment || "").trim();
  if (!normalized.id || !userId || !Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
    throw new Error("Choose a rating between 1 and 5.");
  }

  await setDoc(doc(db, "reviews", normalized.id), {
    bookingId: normalized.id,
    caregiverId: normalized.caregiverId,
    customerId: userId,
    rating: numericRating,
    comment: cleanComment.slice(0, 600),
    isVerifiedReview: true,
    createdAt: serverTimestamp(),
  });
}
