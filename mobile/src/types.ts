export type UserRole = "user" | "caregiver" | "orgadmin" | "superadmin";

export type SewakProfile = {
  uid: string;
  name?: string;
  email?: string;
  phone?: string;
  role: UserRole;
  profileComplete?: boolean;
};

export type Caregiver = {
  id: string;
  name: string;
  location?: string;
  bio?: string;
  hourlyRate?: number | null;
  experience?: number | null;
  workType?: "parttime" | "fulltime" | string;
  servicesOffered?: string[];
  serviceLabels?: string[];
  rating?: number | null;
  reviewCount?: number | null;
  isAvailable?: boolean;
  organizationName?: string;
};

export type BookingStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | string;

export type Booking = {
  id: string;
  caregiverId: string;
  caregiverName?: string;
  caregiverLocation?: string;
  date?: string;
  time?: string;
  durationHours?: number;
  status: BookingStatus;
  totalAmount?: number | null;
  paymentStatus?: string;
  careRecipient?: string;
  careNeeds?: string;
  notes?: string;
};

export type CreateBookingInput = {
  caregiverId: string;
  careRecipient: string;
  careNeeds: string;
  date: string;
  time: string;
  durationHours: number;
  recurrence: "one_time" | "recurring";
  fullName: string;
  phone: string;
  address: string;
  city: string;
  notes?: string;
};
