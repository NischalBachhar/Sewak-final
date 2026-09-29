import { BookingDraft, Caregiver, Quote } from "@/types";

export const WINDOW_END: Record<string, string> = {
  morning: "12:00",
  day: "17:00",
  evening: "21:00",
  night: "23:59",
};

export const normalizePhone = (value: string) => {
  const phone = String(value || "").replace(/[\s()-]/g, "");
  return /^(98|97)\d{8}$/.test(phone) ? `+977${phone}` : phone;
};

export function scheduleBoundary(input: Pick<BookingDraft, "date" | "time" | "requestedTimeWindows">) {
  const lastWindow = (input.requestedTimeWindows || [])
    .map((key) => WINDOW_END[key])
    .filter(Boolean)
    .sort()
    .pop();
  return new Date(`${input.date}T${input.time || lastWindow || "00:00"}:00+05:45`);
}

function kathmanduDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function validateBooking(input: BookingDraft, caregiver: Caregiver, now = new Date()) {
  const errors: string[] = [];
  const required = (value: string, min: number, max: number, label: string) => {
    const clean = String(value || "").trim();
    if (clean.length < min || clean.length > max) errors.push(`${label} must contain ${min}–${max} characters.`);
  };

  required(input.careRecipient, 2, 120, "Person needing care");

  if (!caregiver.servicesOffered?.includes(input.serviceId)) {
    errors.push("Choose a service this caregiver offers.");
  }

  const windows = input.requestedTimeWindows || [];
  const partTime = ["parttime", "part_time"].includes(String(caregiver.workType || ""));
  const boundary = scheduleBoundary(input);
  const validDate =
    Number.isFinite(boundary.getTime()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(input.date) &&
    kathmanduDate(boundary) === input.date;

  if (
    !validDate ||
    (!input.time && (!partTime || !windows.length)) ||
    (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) ||
    windows.some((value) => !WINDOW_END[value]) ||
    new Set(windows).size !== windows.length ||
    boundary <= now
  ) {
    errors.push("Choose a future schedule in Nepal time, with an exact start time or supported time window.");
  }

  if (!Number.isInteger(Number(input.durationHours)) || Number(input.durationHours) < 1 || Number(input.durationHours) > 24) {
    errors.push("Duration must be 1–24 whole hours.");
  }

  if (!["one_time", "recurring"].includes(input.recurrence)) {
    errors.push("Choose a supported frequency.");
  }

  required(input.userName, 2, 120, "Contact name");
  required(input.address, 5, 300, "Address");
  required(input.city, 2, 100, "City");

  if (!/^\+[1-9]\d{7,14}$/.test(normalizePhone(input.userPhone))) {
    errors.push("Use a Nepali mobile number or an international number beginning with + and country code.");
  }

  if (String(input.careNeeds || "").length > 1000 || String(input.notes || "").length > 1500) {
    errors.push("Care needs or instructions are too long.");
  }

  return errors;
}

export function calculateQuote(caregiver: Caregiver, duration: number): Quote {
  const rate = Number(caregiver.hourlyRate);
  const commissionRate = Number(caregiver.commissionRate ?? 15);
  if (
    !Number.isFinite(rate) ||
    rate < 0 ||
    rate > 1_000_000 ||
    (rate === 0 && caregiver.allowZeroRate !== true) ||
    !Number.isFinite(commissionRate) ||
    commissionRate < 0 ||
    commissionRate > 100
  ) {
    throw new Error("The caregiver's booking rate is not configured. Please contact support.");
  }
  const rateMinor = Math.round(rate * 100);
  const totalMinor = rateMinor * Number(duration);
  const commissionMinor = Math.round((totalMinor * commissionRate) / 100);
  return {
    hourlyRate: rateMinor / 100,
    commissionRate,
    totalAmount: totalMinor / 100,
    platformCommission: commissionMinor / 100,
    vendorEarnings: (totalMinor - commissionMinor) / 100,
    amountDue: totalMinor / 100,
  };
}

export const formatNpr = (amount?: number | null) =>
  Number.isFinite(Number(amount))
    ? `NPR ${Number(amount).toLocaleString("en-NP", { maximumFractionDigits: 2 })}`
    : "On request";
