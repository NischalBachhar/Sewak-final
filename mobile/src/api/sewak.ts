import { apiRequest, usingMockData } from "@/api/client";
import {
  Booking,
  Caregiver,
  CreateBookingInput,
  SewakProfile,
} from "@/types";

const sampleCaregivers: Caregiver[] = [
  {
    id: "sample-caregiver-1",
    name: "Sample Caregiver",
    location: "Kathmandu",
    bio: "Demo profile for mobile UI development. Replace with live Sewak data when the Worker API is connected.",
    hourlyRate: 500,
    experience: 4,
    workType: "parttime",
    serviceLabels: ["Elderly care", "Patient support"],
    rating: 4.8,
    reviewCount: 18,
    isAvailable: true,
  },
  {
    id: "sample-caregiver-2",
    name: "Sample Home Caregiver",
    location: "Hetauda",
    bio: "Demo caregiver used only while mock mode is enabled.",
    hourlyRate: 450,
    experience: 3,
    workType: "fulltime",
    serviceLabels: ["Child care", "Home support"],
    rating: 4.7,
    reviewCount: 11,
    isAvailable: true,
  },
];

export async function getMyProfile(): Promise<SewakProfile | null> {
  if (usingMockData) return null;
  return apiRequest<SewakProfile>("/api/me", { authenticated: true });
}

export async function listCaregivers(): Promise<Caregiver[]> {
  if (usingMockData) return sampleCaregivers;
  const payload = await apiRequest<{ caregivers?: Caregiver[] } | Caregiver[]>(
    "/api/public/caregivers",
  );
  return Array.isArray(payload) ? payload : payload.caregivers ?? [];
}

export async function getCaregiver(id: string): Promise<Caregiver> {
  if (usingMockData) {
    const found = sampleCaregivers.find((item) => item.id === id);
    if (!found) throw new Error("Caregiver not found.");
    return found;
  }
  return apiRequest<Caregiver>(`/api/public/caregivers/${encodeURIComponent(id)}`);
}

export async function listMyBookings(): Promise<Booking[]> {
  if (usingMockData) return [];
  const payload = await apiRequest<{ bookings?: Booking[] } | Booking[]>(
    "/api/bookings/me",
    { authenticated: true },
  );
  return Array.isArray(payload) ? payload : payload.bookings ?? [];
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<{ id: string }> {
  if (usingMockData) {
    return { id: `mock-${Date.now()}` };
  }

  return apiRequest<{ id: string }>("/api/bookings", {
    method: "POST",
    authenticated: true,
    body: JSON.stringify(input),
  });
}
