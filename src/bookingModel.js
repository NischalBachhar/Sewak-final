export const BOOKING_STATUS = {
  pending: {
    label: "Waiting for caregiver",
    tone: "pending",
    nextStep: "We have sent your request to the caregiver. We will notify you when they respond.",
  },
  accepted: {
    label: "Booking confirmed",
    tone: "confirmed",
    nextStep: "Your caregiver has accepted. They can check in when the care session begins.",
  },
  in_progress: {
    label: "Care in progress",
    tone: "active",
    nextStep: "Your caregiver has checked in. Follow care tasks and updates here.",
  },
  completed: {
    label: "Care completed",
    tone: "completed",
    nextStep: "This care session has finished. You can share a review based on this completed booking.",
  },
  cancelled: {
    label: "Cancelled",
    tone: "cancelled",
    nextStep: "This booking will not go ahead. Contact Sewak Support if you need help finding another caregiver.",
  },
  issue_reported: {
    label: "Support is reviewing an issue",
    tone: "issue",
    nextStep: "Sewak Support is reviewing this booking. Please use the support contact if you need urgent help.",
  },
};

export const getBookingStatus = (status) =>
  BOOKING_STATUS[status] || BOOKING_STATUS.pending;

export const normalizeBooking = (booking = {}) => ({
  ...booking,
  caregiverName: booking.caregiverName || booking.vendorName || "Caregiver",
  vendorName: booking.vendorName || booking.caregiverName || "Caregiver",
  caregiverId: booking.caregiverId || booking.vendorId || "",
  date: booking.date || booking.bookingDate || "",
  bookingDate: booking.bookingDate || booking.date || "",
  time: booking.time || booking.startTime || "",
  startTime: booking.startTime || booking.time || "",
  endTime: booking.endTime || "",
  durationHours: Number(booking.durationHours || booking.duration || 0),
  totalAmount: Number(booking.totalAmount ?? booking.amountDue ?? booking.amount ?? 0),
  status: booking.status === "confirmed" ? "accepted" : (booking.status || "pending"),
  paymentStatus: booking.paymentStatus || "pending",
  serviceLabel: booking.serviceLabel || booking.serviceName || "Care support",
});

export const bookingScheduleLabel = (booking) => {
  const normalized = normalizeBooking(booking);
  const dateTime = [normalized.date, normalized.time].filter(Boolean).join(" at ");
  const duration = normalized.durationHours
    ? ` · ${normalized.durationHours} ${normalized.durationHours === 1 ? "hour" : "hours"}`
    : "";
  return `${dateTime || "Schedule to be confirmed"}${duration}`;
};

export const getCaregiverVerification = (caregiver = {}) => [
  {
    key: "identity",
    label: "Identity verified",
    state: caregiver.identityVerificationStatus || (caregiver.verified ? "verified" : "not_verified"),
  },
  {
    key: "phone",
    label: "Phone verified",
    state: caregiver.phoneVerificationStatus || "not_verified",
  },
  {
    key: "training",
    label: "Training verified",
    state:
      caregiver.trainingVerificationStatus || (caregiver.isCertified ? "verified" : "not_verified"),
  },
  {
    key: "background",
    label: "Background check",
    state: caregiver.backgroundVerificationStatus || (caregiver.backgroundChecked ? "verified" : "not_verified"),
  },
  {
    key: "references",
    label: "References verified",
    state: caregiver.referencesVerificationStatus || "not_verified",
  },
];

export const hasVerifiedRating = (caregiver = {}) =>
  Number(caregiver.reviewCount) > 0 && Number.isFinite(Number(caregiver.rating));

export const isActiveBooking = (booking = {}) => normalizeBooking(booking).status === "in_progress";
