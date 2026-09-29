export type UserRole = "user" | "caregiver" | "orgadmin" | "superadmin";

export type SewakProfile = {
  uid?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  location?: string;
  role?: UserRole;
  profileComplete?: boolean;
  organizationName?: string;
  profilePicture?: string;
  profileImage?: string;
  [key: string]: unknown;
};

export type SewakUser = {
  id: string;
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  profile?: SewakProfile | null;
};

export type SessionMetadata = {
  id: string;
  expiresAt?: string;
  transport?: string;
  createdAt?: string;
  lastSeenAt?: string;
  current?: boolean;
  [key: string]: unknown;
};

export type PublicService = {
  id: string;
  serviceId?: string;
  label?: string;
  serviceName?: string;
  category?: string;
  description?: string;
  price?: number;
  isActive?: boolean;
};

export type Caregiver = {
  id: string;
  caregiverId?: string;
  name: string;
  phone?: string;
  location?: string;
  bio?: string;
  hourlyRate?: number | null;
  commissionRate?: number | null;
  allowZeroRate?: boolean;
  experience?: number | null;
  workType?: "parttime" | "part_time" | "fulltime" | string;
  shifts?: string[];
  servicesOffered?: string[];
  serviceLabels?: string[];
  rating?: number | null;
  reviewCount?: number | null;
  jobsCompleted?: number | null;
  isAvailable?: boolean;
  organizationId?: string;
  organizationName?: string;
  profileImage?: string;
  profilePicture?: string;
  verified?: boolean;
  backgroundChecked?: boolean;
  isCertified?: boolean;
  identityVerificationStatus?: string;
  phoneVerificationStatus?: string;
  trainingVerificationStatus?: string;
  backgroundVerificationStatus?: string;
  referencesVerificationStatus?: string;
  category?: string;
};

export type PublicReview = {
  id: string;
  caregiverId?: string;
  rating: number;
  comment?: string;
  createdAt?: string;
  isVerifiedReview?: boolean;
  reviewerName?: string;
};

export type BookingStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "issue_reported"
  | string;

export type Booking = {
  id: string;
  userId: string;
  userName?: string;
  userPhone?: string;
  userEmail?: string;
  address?: string;
  city?: string;
  caregiverId: string;
  vendorId?: string;
  caregiverName?: string;
  caregiverLocation?: string;
  caregiverWorkType?: string;
  caregiverShifts?: string[];
  organizationId?: string;
  organizationName?: string;
  serviceId?: string;
  serviceLabel?: string;
  date?: string;
  time?: string;
  requestedTimeWindows?: string[];
  durationHours?: number;
  recurrence?: "one_time" | "recurring" | string;
  scheduleAt?: string;
  status: BookingStatus;
  hourlyRate?: number | null;
  commissionRate?: number | null;
  totalAmount?: number | null;
  platformCommission?: number | null;
  vendorEarnings?: number | null;
  amountDue?: number | null;
  paymentStatus?: string;
  paymentMethod?: string;
  careRecipient?: string;
  careNeeds?: string;
  notes?: string;
  careSessionId?: string;
  requestFingerprint?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CareSession = {
  id: string;
  bookingId: string;
  caregiverId: string;
  customerId?: string;
  organizationId?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  scheduledDurationHours?: number;
  status?: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CareTask = {
  id: string;
  label: string;
  status: "pending" | "completed" | string;
  createdBy?: string;
  createdAt?: string;
  completedAt?: string;
  completedBy?: string;
};

export type CareUpdate = {
  id: string;
  caregiverId?: string;
  type?: "note" | "milestone" | string;
  message: string;
  createdAt?: string;
};

export type Quote = {
  hourlyRate: number;
  commissionRate: number;
  totalAmount: number;
  platformCommission: number;
  vendorEarnings: number;
  amountDue: number;
};

export type BookingDraft = {
  serviceId: string;
  serviceLabel: string;
  careRecipient: string;
  date: string;
  time: string;
  requestedTimeWindows: string[];
  durationHours: number;
  recurrence: "one_time" | "recurring";
  userName: string;
  userPhone: string;
  address: string;
  city: string;
  careNeeds: string;
  notes: string;
};
