import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { OrganizationSidebar, OrganizationOverview, OrganizationTeamList, OrganizationBookingsPanel } from "./OrganizationWorkspace";

const history = {
  rows: [{ id: "booking-1", caregiverName: "Laxman Tamang", userName: "Demo Customer", serviceLabel: "Elder care", date: "2026-10-11", time: "11:00", totalAmount: 400, vendorEarnings: 340, status: "completed", paymentStatus: "pending" }],
  totals: { total: 1, completed: 1, revenue: 400, earnings: 340, matching: 1 },
  filter: "",
  setFilter: jest.fn(),
  stale: false,
  error: "",
  loading: false,
  hasPrevious: false,
  hasNext: false,
  previous: jest.fn(),
  next: jest.fn(),
};
describe("organization workspace redesign", () => {
  test("sidebar selects sections accessibly", () => {
    const select = jest.fn();
    render(<OrganizationSidebar activeTab="overview" onSelect={select} organizationName="KTM Care"/>);
    expect(screen.getByRole("button", { name: "Overview" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Bookings" }));
    expect(select).toHaveBeenCalledWith("bookings");
  });
  test("overview displays recorded values without claiming paid earnings", () => {
    render(<OrganizationOverview caregivers={[{ id: "a", isAvailable: true, isApproved: true }]} services={[]} bookingHistory={history} onSelect={jest.fn()}/>);
    expect(screen.getByText("Rs. 400")).toBeTruthy();
    expect(screen.getByText("Rs. 340")).toBeTruthy();
    expect(screen.getByText("Not a payout confirmation")).toBeTruthy();
  });
  test("staff filters match the canonical household vendor category", () => {
    render(<OrganizationTeamList caregivers={[{ id: "1", name: "House Worker", category: "vendor", location: "Butwal", isApproved: true, isAvailable: true }]} orgBlacklist={[]} services={[]}/>);
    fireEvent.change(screen.getByRole("combobox", { name: "Service category" }), { target: { value: "household" } });
    expect(screen.getByText("House Worker")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Service category" }), { target: { value: "caregiver" } });
    expect(screen.getByText("No matching team members")).toBeTruthy();
  });
  test("booking list exposes read-only detail view and accessible close", () => {
    render(<OrganizationBookingsPanel bookingHistory={history}/>);
    expect(screen.getByText("Laxman Tamang")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /View details/i }));
    const dialog=screen.getByRole("dialog");
    expect(within(dialog).getByText("booking-1")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: /Close booking details/i }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  test("booking status filter supports issue reported", () => {
    render(<OrganizationBookingsPanel bookingHistory={history}/>);
    fireEvent.change(screen.getByRole("combobox", { name: "Booking status" }), { target: { value: "issue_reported" } });
    expect(history.setFilter).toHaveBeenCalledWith("issue_reported");
  });
});
