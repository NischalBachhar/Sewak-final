import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import WorkspaceShell from "./WorkspaceShell";
import CareWeekPreview from "./CareWeekPreview";

test("caregiver workspace exposes accessible navigation and preserves caller handlers", () => {
  const selected = jest.fn();
  render(
    <WorkspaceShell
      role="caregiver"
      title="Good day"
      subtitle="Your care"
      activeTab="jobs"
      onSelect={selected}
      items={[{ id: "home" }, { id: "jobs", count: 2 }, { id: "schedule" }]}
    >
      <p>Existing booking workflow</p>
    </WorkspaceShell>,
  );
  expect(screen.getByRole("navigation", { name: "Caregiver sections" })).toBeTruthy();
  expect(screen.getByText("Existing booking workflow")).toBeTruthy();
  expect(screen.getByRole("button", { name: /job requests/i }).getAttribute("aria-current")).toBe("page");
  fireEvent.click(screen.getByRole("button", { name: /my schedule/i }));
  expect(selected).toHaveBeenCalledWith("schedule");
  fireEvent.change(screen.getByRole("combobox", { name: "Caregiver section" }), { target: { value: "jobs" } });
  expect(selected).toHaveBeenLastCalledWith("jobs");
});

test("superadmin workspace renders only supplied authorized navigation entries", () => {
  render(
    <WorkspaceShell
      role="admin"
      title="Platform overview"
      subtitle="Operations"
      activeTab="overview"
      onSelect={() => {}}
      items={[{ id: "overview" }, { id: "bookings" }]}
    >
      <p>Dashboard content</p>
    </WorkspaceShell>,
  );
  const navigation = screen.getByRole("navigation", { name: "Administration sections" });
  expect(navigation).toBeTruthy();
  expect(screen.getByRole("button", { name: "Bookings" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Administrator access" })).toBeNull();
});

test("weekly care preview shows navigable dates without inventing bookings", () => {
  render(<CareWeekPreview bookings={[]} />);
  expect(screen.getAllByText("No visits")).toHaveLength(7);
  const datesBefore = screen.getByLabelText("Weekly accepted care overview").textContent;
  fireEvent.click(screen.getByRole("button", { name: "Next week" }));
  const datesAfter = screen.getByLabelText("Weekly accepted care overview").textContent;
  expect(datesAfter).not.toBe(datesBefore);
  expect(screen.getAllByText("No visits")).toHaveLength(7);
});
