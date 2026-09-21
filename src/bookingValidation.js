export const canonicalCategory = (value) => value === "household" ? "vendor" : value;
export const kathmanduDate = (now = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit",
}).format(now);
export const WINDOW_END = { morning: "12:00", day: "17:00", evening: "21:00", night: "23:59" };
export const normalizePhone = (value) => {
  const phone = String(value || "").replace(/[\s()-]/g, "");
  return /^(98|97)\d{8}$/.test(phone) ? `+977${phone}` : phone;
};
export function scheduleBoundary(input) {
  const lastWindow = (input.requestedTimeWindows || []).map((key) => WINDOW_END[key]).filter(Boolean).sort().pop();
  return new Date(`${input.date}T${input.time || lastWindow || "00:00"}:00+05:45`);
}
export function validateBooking(input, caregiver, now = new Date()) {
  const errors = [];
  const required = (key, min, max, step, field, label) => {
    const value = String(input[key] || "").trim();
    if (value.length < min || value.length > max) errors.push({ step, field, message: `${label} must contain ${min}–${max} characters.` });
  };
  required("careRecipient", 2, 120, 0, "care-recipient", "Person needing care");
  if (!caregiver?.servicesOffered?.includes(input.serviceId)) errors.push({ step: 0, field: "care-service", message: "Choose a service this caregiver offers." });
  const windows = input.requestedTimeWindows || [];
  const partTime = ["parttime", "part_time"].includes(caregiver?.workType);
  const validDate = Number.isFinite(scheduleBoundary(input).getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(input.date) && kathmanduDate(scheduleBoundary(input)) === input.date;
  if (!validDate || (!input.time && (!partTime || !windows.length)) ||
      (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) ||
      windows.some((value) => !WINDOW_END[value]) || new Set(windows).size !== windows.length ||
      !Number.isFinite(scheduleBoundary(input).getTime()) || scheduleBoundary(input) <= now) {
    errors.push({ step: 1, field: "booking-date", message: "Choose a future schedule in Asia/Kathmandu, with a start time or a supported time window." });
  }
  if (!Number.isInteger(Number(input.durationHours)) || Number(input.durationHours) < 1 || Number(input.durationHours) > 24) errors.push({ step: 1, field: "booking-duration", message: "Duration must be 1–24 whole hours." });
  if (!["one_time", "recurring"].includes(input.recurrence)) errors.push({ step: 1, field: "booking-recurrence", message: "Choose a supported frequency." });
  required("userName", 2, 120, 2, "booking-name", "Contact name");
  required("address", 5, 300, 2, "booking-address", "Address");
  required("city", 2, 100, 2, "booking-city", "City");
  if (!/^\+[1-9]\d{7,14}$/.test(normalizePhone(input.userPhone))) errors.push({ step: 2, field: "booking-phone", message: "Use a Nepali mobile number or an international number beginning with + and country code." });
  if (String(input.careNeeds || "").length > 1000 || String(input.notes || "").length > 1500) errors.push({ step: 2, field: "booking-notes", message: "Care needs or instructions are too long." });
  return errors;
}
export function calculateQuote(caregiver, duration) {
  const rate = Number(caregiver.hourlyRate);
  const commissionRate = Number(caregiver.commissionRate ?? 15);
  if (!Number.isFinite(rate) || rate < 0 || rate > 1000000 || (rate === 0 && caregiver.allowZeroRate !== true) ||
      !Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) throw new Error("The caregiver's booking rate is not configured. Please contact support.");
  const rateMinor = Math.round(rate * 100);
  const totalMinor = rateMinor * Number(duration);
  const commissionMinor = Math.round(totalMinor * commissionRate / 100);
  return { hourlyRate: rateMinor / 100, commissionRate, totalAmount: totalMinor / 100,
    platformCommission: commissionMinor / 100, vendorEarnings: (totalMinor - commissionMinor) / 100,
    amountDue: totalMinor / 100 };
}
