import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { apiRequest, absoluteApiUrl } from "@/api/client";
import { calculateQuote, normalizePhone, scheduleBoundary, validateBooking } from "@/domain/booking";
import {
  Booking,
  BookingDraft,
  Caregiver,
  CareSession,
  CareTask,
  CareUpdate,
  PublicReview,
  PublicService,
  Organization,
  OrganizationApplication,
  Quote,
  SewakProfile,
  SewakUser,
} from "@/types";

type QueryItem<T> = {
  id: string;
  path: string;
  version?: number;
  data: T;
  cursor?: { id: string; value: string };
};

type QueryResponse<T> = {
  items: QueryItem<T>[];
  nextCursor?: { id: string; value: string } | null;
};

type QueryFilter = { field: string; op: "==" | "in"; value: string | boolean | number | Array<string | boolean | number> };

const serverTimestamp = () => ({ __op: "serverTimestamp" });
const deleteField = () => ({ __op: "delete" });

async function queryResource<T>(
  path: string,
  options: {
    filters?: QueryFilter[];
    order?: { field: "__name__" | "createdAt"; direction: "asc" | "desc" };
    limit?: number;
    authenticated?: boolean;
  } = {},
) {
  const result = await apiRequest<QueryResponse<T>>("/api/query", {
    method: "POST",
    authenticated: options.authenticated ?? false,
    json: {
      path,
      filters: options.filters || [],
      ...(options.order ? { order: options.order } : {}),
      limit: options.limit || 50,
    },
  });
  return result.items.map((item) => ({ id: item.id, ...item.data }));
}

async function getRecord<T>(path: string, authenticated = false) {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  const result = await apiRequest<QueryResponse<T>>(`/api/records/${encoded}`, {
    authenticated,
  });
  const item = result.items[0];
  return item ? ({ id: item.id, ...item.data } as T & { id: string }) : null;
}

async function commit(
  writes: Array<{
    path: string;
    kind: "set" | "update" | "delete";
    data?: Record<string, unknown>;
    merge?: boolean;
  }>,
  preconditions: Array<{ path: string; version: number }> = [],
) {
  return apiRequest("/api/commit", {
    method: "POST",
    authenticated: true,
    json: { writes, preconditions },
  });
}

const labelForService = (id: string, services: PublicService[]) => {
  const match = services.find((service) => service.id === id || service.serviceId === id);
  return match?.label || match?.serviceName || id.replace(/_/g, " ");
};

const resolveCaregiverServices = (caregiver: Caregiver, services: PublicService[]) => {
  const activeIds = new Set<string>();
  for (const service of services) {
    if (service.isActive === false) continue;
    if (service.id) activeIds.add(service.id);
    if (service.serviceId) activeIds.add(service.serviceId);
  }
  const servicesOffered = (caregiver.servicesOffered || []).filter((id) => activeIds.has(id));
  return {
    ...caregiver,
    servicesOffered,
    serviceLabels: servicesOffered.map((id) => labelForService(id, services)),
  };
};

export async function listPublicServices() {
  return queryResource<Omit<PublicService, "id">>("publicServices", { limit: 50 });
}

export async function listCaregivers() {
  const [caregivers, services] = await Promise.all([
    queryResource<Omit<Caregiver, "id">>("publicCaregivers", {
      filters: [
        { field: "isApproved", op: "==", value: true },
        { field: "isSuspended", op: "==", value: false },
        { field: "isBlacklisted", op: "==", value: false },
        { field: "isOrganizationActive", op: "==", value: true },
      ],
      order: { field: "__name__", direction: "asc" },
      limit: 50,
    }),
    listPublicServices(),
  ]);

  return caregivers.map((caregiver) => {
    const resolved = resolveCaregiverServices(caregiver as Caregiver, services);
    return {
      ...resolved,
      profileImage: caregiver.profileImage ? absoluteApiUrl(caregiver.profileImage) : "",
      profilePicture: caregiver.profilePicture ? absoluteApiUrl(caregiver.profilePicture) : "",
    };
  });
}

export async function getCaregiver(id: string) {
  const [caregiver, services] = await Promise.all([
    getRecord<Omit<Caregiver, "id">>(`publicCaregivers/${id}`),
    listPublicServices(),
  ]);
  if (!caregiver) throw new Error("This caregiver profile is not available.");
  const resolved = resolveCaregiverServices(caregiver as Caregiver, services);
  return {
    ...resolved,
    profileImage: caregiver.profileImage ? absoluteApiUrl(caregiver.profileImage) : "",
    profilePicture: caregiver.profilePicture ? absoluteApiUrl(caregiver.profilePicture) : "",
  } as Caregiver;
}

export async function listPublicReviews(caregiverId: string) {
  return queryResource<Omit<PublicReview, "id">>("publicReviews", {
    filters: [{ field: "caregiverId", op: "==", value: caregiverId }],
    order: { field: "createdAt", direction: "desc" },
    limit: 50,
  });
}

export async function getMyProfile(uid: string) {
  const profile = await getRecord<Omit<SewakProfile, "id">>(`users/${uid}`, true);
  if (!profile) throw new Error("Your Sewak profile could not be loaded.");
  return profile;
}

export async function updateCustomerProfile(
  uid: string,
  data: { name: string; phone: string; address: string; city: string },
) {
  await commit([
    {
      path: `users/${uid}`,
      kind: "set",
      merge: true,
      data: {
        ...data,
        profileComplete: true,
        updatedAt: new Date().toISOString(),
      },
    },
  ]);
}

export async function getCaregiverPrivateProfile(uid: string) {
  return getRecord<Omit<Caregiver, "id">>(`vendors/${uid}`, true);
}

export async function updateCaregiverProfile(
  uid: string,
  data: {
    name: string;
    phone: string;
    location: string;
    bio: string;
    workType: string;
    shifts: string[];
    hourlyRate: number;
    experience: number;
    isAvailable: boolean;
  },
) {
  const updatedAt = new Date().toISOString();
  await commit([
    {
      path: `vendors/${uid}`,
      kind: "update",
      data: { ...data, updatedAt },
    },
    {
      path: `users/${uid}`,
      kind: "update",
      data: { name: data.name, phone: data.phone, location: data.location, updatedAt },
    },
  ]);
}

export async function listBookings(user: SewakUser) {
  const roleField =
    user.role === "caregiver"
      ? "caregiverId"
      : user.role === "orgadmin"
        ? "organizationId"
        : "userId";
  return queryResource<Omit<Booking, "id">>("bookings", {
    authenticated: true,
    filters: [{ field: roleField, op: "==", value: user.uid }],
    order: { field: "createdAt", direction: "desc" },
    limit: 50,
  });
}

export async function getBooking(id: string) {
  const value = await getRecord<Omit<Booking, "id">>(`bookings/${id}`, true);
  if (!value) throw new Error("Booking not found.");
  return value as Booking;
}

export async function updateBookingStatus(id: string, status: Booking["status"]) {
  await commit([
    {
      path: `bookings/${id}`,
      kind: "update",
      data: { status, updatedAt: serverTimestamp() },
    },
  ]);
}

const attemptKey = (uid: string, caregiverId: string) =>
  `sewak.bookingAttempt.v2:${uid}:${caregiverId}`;

type BookingAttempt = { id: string; fingerprint: string };

async function readAttempt(uid: string, caregiverId: string): Promise<BookingAttempt | null> {
  try {
    const raw = await AsyncStorage.getItem(attemptKey(uid, caregiverId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function clearAttempt(uid: string, caregiverId: string) {
  await AsyncStorage.removeItem(attemptKey(uid, caregiverId));
}

async function bookingFingerprint(value: unknown) {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    JSON.stringify(value),
    { encoding: Crypto.CryptoEncoding.HEX },
  );
}

const pendingBookings = new Map<string, Promise<Booking | { changedQuote: Quote }>>();

export async function createBooking(args: {
  user: SewakUser;
  caregiver: Caregiver;
  input: BookingDraft;
  confirmedQuote: Quote;
}) {
  const key = attemptKey(args.user.uid, args.caregiver.id);
  const existingWork = pendingBookings.get(key);
  if (existingWork) return existingWork;

  const work = (async () => {
    const freshCaregiver = await getCaregiver(args.caregiver.id);
    const errors = validateBooking(args.input, freshCaregiver);
    if (errors.length) throw new Error(errors[0]);

    const freshQuote = calculateQuote(freshCaregiver, args.input.durationHours);
    if (JSON.stringify(freshQuote) !== JSON.stringify(args.confirmedQuote)) {
      return { changedQuote: freshQuote };
    }

    const fingerprint = await bookingFingerprint({
      userId: args.user.uid,
      caregiverId: freshCaregiver.id,
      ...args.input,
      userPhone: normalizePhone(args.input.userPhone),
    });

    let attempt = await readAttempt(args.user.uid, freshCaregiver.id);
    if (attempt && attempt.fingerprint !== fingerprint) {
      await clearAttempt(args.user.uid, freshCaregiver.id);
      attempt = null;
    }

    if (attempt) {
      const recovered = await getRecord<Omit<Booking, "id">>(`bookings/${attempt.id}`, true).catch(() => null);
      if (recovered) {
        if (recovered.requestFingerprint !== fingerprint) throw new Error("This booking attempt has different details.");
        await clearAttempt(args.user.uid, freshCaregiver.id);
        return recovered as Booking;
      }
    }

    if (!attempt) {
      attempt = {
        id: `${args.user.uid}_${Crypto.randomUUID()}`,
        fingerprint,
      };
      await AsyncStorage.setItem(key, JSON.stringify(attempt));
    }

    const booking: Record<string, unknown> = {
      ...args.input,
      userId: args.user.uid,
      userEmail: args.user.email || "",
      userPhone: normalizePhone(args.input.userPhone),
      durationHours: Number(args.input.durationHours),
      caregiverId: freshCaregiver.id,
      vendorId: freshCaregiver.id,
      organizationId: freshCaregiver.organizationId || "",
      organizationName: freshCaregiver.organizationName || "",
      caregiverName: freshCaregiver.name || "Caregiver",
      caregiverLocation: freshCaregiver.location || "",
      caregiverWorkType: freshCaregiver.workType || "",
      caregiverShifts: freshCaregiver.shifts || [],
      caregiverCategory: freshCaregiver.category || "caregiver",
      ...freshQuote,
      status: "pending",
      paymentMethod: "cash",
      paymentStatus: "pending",
      schemaVersion: 2,
      requestFingerprint: fingerprint,
      scheduleAt: scheduleBoundary(args.input).toISOString(),
      createdAt: serverTimestamp(),
    };

    await commit([{ path: `bookings/${attempt.id}`, kind: "set", data: booking }]);
    const created = { id: attempt.id, ...booking } as Booking;
    await clearAttempt(args.user.uid, freshCaregiver.id);
    return created;
  })();

  pendingBookings.set(key, work);
  try {
    return await work;
  } finally {
    if (pendingBookings.get(key) === work) pendingBookings.delete(key);
  }
}

export async function getCareSession(bookingId: string) {
  return getRecord<Omit<CareSession, "id">>(`careSessions/${bookingId}`, true);
}

export async function listCareTasks(bookingId: string) {
  return queryResource<Omit<CareTask, "id">>(`careSessions/${bookingId}/tasks`, {
    authenticated: true,
    order: { field: "createdAt", direction: "asc" },
    limit: 50,
  });
}

export async function listCareUpdates(bookingId: string) {
  return queryResource<Omit<CareUpdate, "id">>(`careSessions/${bookingId}/updates`, {
    authenticated: true,
    order: { field: "createdAt", direction: "desc" },
    limit: 50,
  });
}

export async function startCareSession(booking: Booking, caregiverId: string) {
  await commit([
    {
      path: `careSessions/${booking.id}`,
      kind: "set",
      data: {
        bookingId: booking.id,
        caregiverId,
        customerId: booking.userId,
        organizationId: booking.organizationId || "",
        scheduledDate: booking.date || "",
        scheduledTime: booking.time || "",
        scheduledDurationHours: booking.durationHours || 0,
        status: "in_progress",
        actualCheckIn: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    },
    {
      path: `bookings/${booking.id}`,
      kind: "update",
      data: {
        status: "in_progress",
        careSessionId: booking.id,
        updatedAt: serverTimestamp(),
      },
    },
  ]);
}

export async function finishCareSession(bookingId: string) {
  await commit([
    {
      path: `careSessions/${bookingId}`,
      kind: "update",
      data: {
        status: "completed",
        actualCheckOut: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    },
    {
      path: `bookings/${bookingId}`,
      kind: "update",
      data: { status: "completed", updatedAt: serverTimestamp() },
    },
  ]);
}

export async function addCareTask(bookingId: string, caregiverId: string, label: string) {
  const clean = label.trim().slice(0, 120);
  if (!clean) throw new Error("Add a short task description.");
  const id = Crypto.randomUUID();
  await commit([
    {
      path: `careSessions/${bookingId}/tasks/${id}`,
      kind: "set",
      data: {
        label: clean,
        status: "pending",
        createdBy: caregiverId,
        createdAt: serverTimestamp(),
      },
    },
  ]);
}

export async function toggleCareTask(bookingId: string, task: CareTask, caregiverId: string) {
  const completed = task.status !== "completed";
  await commit([
    {
      path: `careSessions/${bookingId}/tasks/${task.id}`,
      kind: "update",
      data: {
        status: completed ? "completed" : "pending",
        completedAt: completed ? serverTimestamp() : deleteField(),
        completedBy: completed ? caregiverId : deleteField(),
      },
    },
  ]);
}

export async function addCareUpdate(bookingId: string, caregiverId: string, message: string) {
  const clean = message.trim().slice(0, 500);
  if (!clean) throw new Error("Write a short care update.");
  const id = Crypto.randomUUID();
  await commit([
    {
      path: `careSessions/${bookingId}/updates/${id}`,
      kind: "set",
      data: {
        caregiverId,
        type: "note",
        message: clean,
        createdAt: serverTimestamp(),
      },
    },
  ]);
}

export async function getReview(bookingId: string) {
  return getRecord<PublicReview>(`reviews/${bookingId}`, true).catch(() => null);
}

export async function submitReview(booking: Booking, userId: string, rating: number, comment: string) {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Choose a rating between 1 and 5.");
  await commit([
    {
      path: `reviews/${booking.id}`,
      kind: "set",
      data: {
        bookingId: booking.id,
        caregiverId: booking.caregiverId,
        customerId: userId,
        rating,
        comment: comment.trim().slice(0, 600),
        isVerifiedReview: true,
        createdAt: serverTimestamp(),
      },
    },
  ]);
}

export async function submitBookingReport(input: {
  booking: Booking;
  caregiverId: string;
  caregiverName: string;
  reason: string;
  description: string;
}) {
  const id = input.booking.id;
  const existing = await getRecord<Record<string, unknown>>(`reportLocks/${id}`, true).catch(() => null);
  if (existing) return { duplicate: true, id };

  const createdAt = serverTimestamp();
  await commit([
    {
      path: `blacklistReports/${id}`,
      kind: "set",
      data: {
        bookingId: id,
        userId: input.booking.userId,
        userType: "user",
        userName: input.booking.userName || "Customer",
        reportedBy: input.caregiverId,
        reportedByName: input.caregiverName,
        reportedByOrgId: input.booking.organizationId || "",
        reason: input.reason.trim().slice(0, 160),
        description: input.description.trim().slice(0, 1000),
        status: "pending",
        createdAt,
      },
    },
    {
      path: `reportReceipts/${id}`,
      kind: "set",
      data: {
        bookingId: id,
        reportedBy: input.caregiverId,
        reason: input.reason.trim().slice(0, 160),
        status: "pending",
        createdAt,
      },
    },
    {
      path: `reportLocks/${id}`,
      kind: "set",
      data: { reportId: id, reportedBy: input.caregiverId },
    },
  ]);
  return { duplicate: false, id };
}


export async function getOrganization(uid: string) {
  return getRecord<Omit<Organization, "id">>(`organizations/${uid}`, true);
}

export async function getMyOrganizationApplication(uid: string) {
  return getRecord<Omit<OrganizationApplication, "id">>(`organizationApplications/${uid}`, true).catch(() => null);
}

export async function listOrganizationCaregivers(uid: string) {
  return queryResource<Omit<Caregiver, "id">>("vendors", {
    authenticated: true,
    filters: [{ field: "organizationId", op: "==", value: uid }],
    order: { field: "__name__", direction: "asc" },
    limit: 50,
  });
}

export async function listOrganizationServices(uid: string) {
  return queryResource<Omit<PublicService, "id">>("services", {
    authenticated: true,
    filters: [{ field: "organizationId", op: "==", value: uid }],
    order: { field: "__name__", direction: "asc" },
    limit: 50,
  });
}

export async function updateOrganizationCaregiverServices(caregiverId: string, servicesOffered: string[]) {
  if (!servicesOffered.length) throw new Error("Assign at least one active service to this caregiver.");
  await commit([{
    path: `vendors/${caregiverId}`,
    kind: "update",
    data: { servicesOffered, updatedAt: new Date().toISOString() },
  }]);
}

export async function updateOrganizationProfile(
  uid: string,
  data: { organizationName: string; businessPhone: string; businessAddress: string; businessCity: string },
) {
  await commit([{
    path: `organizations/${uid}`,
    kind: "update",
    data: { ...data, profileComplete: true, updatedAt: new Date().toISOString() },
  }]);
}

export async function provisionCaregiver(input: {
  email: string;
  displayName: string;
  phone: string;
  location: string;
  category: "caregiver" | "vendor" | "both";
  workType: "parttime" | "fulltime";
  shifts: string[];
  servicesOffered: string[];
  hourlyRate: number;
  experience: number;
}) {
  return apiRequest<{
    uid: string;
    email: string;
    role: string;
    invitation: { delivery?: string; activationToken: string; warning?: string };
  }>("/api/actions/provisionCaregiverAccount", {
    method: "POST",
    authenticated: true,
    json: input,
  });
}

const serviceIdFor = (uid: string, label: string) =>
  `${uid}_${label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80)}`;

export async function createOrganizationService(
  uid: string,
  organizationName: string,
  label: string,
  category: string,
) {
  const clean = label.trim();
  if (!clean || clean.length > 160) throw new Error("Enter a service name of at most 160 characters.");
  const id = serviceIdFor(uid, clean);
  await commit([{
    path: `services/${id}`,
    kind: "set",
    data: {
      label: clean,
      serviceName: clean,
      category: category === "household" ? "vendor" : category,
      organizationId: uid,
      organizationName,
      description: "",
      price: 0,
      isActive: true,
      createdAt: serverTimestamp(),
      createdBy: uid,
      updatedAt: serverTimestamp(),
    },
  }]);
  return id;
}

export async function updateOrganizationService(id: string, label: string, category: string) {
  const clean = label.trim();
  if (!clean || clean.length > 160) throw new Error("Enter a service name of at most 160 characters.");
  await commit([{
    path: `services/${id}`,
    kind: "update",
    data: {
      label: clean,
      serviceName: clean,
      category: category === "household" ? "vendor" : category,
      updatedAt: serverTimestamp(),
    },
  }]);
}

export async function retireOrganizationService(id: string) {
  await commit([{
    path: `services/${id}`,
    kind: "update",
    data: { isActive: false, updatedAt: serverTimestamp() },
  }]);
}

export async function uploadProfileImage(uid: string, bytes: ArrayBuffer, mimeType = "image/jpeg") {
  return apiRequest<{ id: string; url: string; width: number; height: number; size: number }>(
    `/api/profiles/${encodeURIComponent(uid)}/image`,
    {
      method: "PUT",
      authenticated: true,
      headers: { "Content-Type": mimeType },
      body: bytes as any,
    },
  );
}

export async function deleteProfileImage(uid: string) {
  return apiRequest<{ deleted: boolean }>(
    `/api/profiles/${encodeURIComponent(uid)}/image`,
    { method: "DELETE", authenticated: true },
  );
}
