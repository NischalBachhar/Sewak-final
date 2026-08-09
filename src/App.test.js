import { getBookingStatus, normalizeBooking } from "./bookingModel";

test("normalizes legacy and current booking fields into one customer/admin view model", () => {
  const booking = normalizeBooking({
    id: "booking-123",
    vendorName: "Asha Care",
    vendorId: "caregiver-123",
    bookingDate: "2026-08-10",
    startTime: "09:00",
    duration: 4,
    amountDue: 1200,
    status: "confirmed",
  });

  expect(booking.caregiverName).toBe("Asha Care");
  expect(booking.caregiverId).toBe("caregiver-123");
  expect(booking.date).toBe("2026-08-10");
  expect(booking.time).toBe("09:00");
  expect(booking.durationHours).toBe(4);
  expect(booking.totalAmount).toBe(1200);
  expect(booking.status).toBe("accepted");
});

test("provides a truthful next step for care in progress", () => {
  expect(getBookingStatus("in_progress").nextStep).toMatch(/checked in/i);
});
