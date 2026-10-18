import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { apiRequest } from "../apiClient";
import CaregiverPreview from "./CaregiverPreview";
import AvailabilityBadge from "./AvailabilityBadge";

// Match the existing logout test's supported router setup.
jest.mock("react-router-dom", () => {
  global.TextEncoder = require("util").TextEncoder;
  global.TextDecoder = require("util").TextDecoder;
  return jest.requireActual("react-router");
});

jest.mock("../apiClient", () => ({ apiRequest: jest.fn() }));
jest.mock("./ProfileImage", () => ({ __esModule: true, default: ({ alt }) => <span>{alt}</span> }));

const profile = {
  name: "Care Partner",
  location: "Lalitpur",
  isApproved: true,
  isAvailable: true,
  servicesOffered: ["service-care"],
  hourlyRate: 350,
  reviewCount: 2,
  rating: 5,
};
const services = { items: [{ id: "service-care", data: { label: "Child Care / Babysitting" } }] };
const caregivers = (profiles) => ({ items: profiles.map(([id, data]) => ({ id, data })) });

beforeEach(() => { apiRequest.mockReset(); window.localStorage.clear(); });

test("request status badge describes the availability toggle, not instant free slots", () => {
  const { rerender } = render(<AvailabilityBadge isAvailable={true} />);
  expect(screen.getByText("Accepting requests")).toBeTruthy();
  expect(screen.getByLabelText(/dates require confirmation/)).toBeTruthy();
  rerender(<AvailabilityBadge isAvailable={false} />);
  expect(screen.getByText("Not accepting requests")).toBeTruthy();
});

test("public homepage preview loads genuine eligible profiles using public queries", async () => {
  apiRequest.mockImplementation((_url, options) => Promise.resolve(
    options.json.path === "publicCaregivers"
      ? caregivers([["care-a", profile], ["care-unavailable", { ...profile, isAvailable: false }]])
      : services,
  ));
  render(<MemoryRouter><CaregiverPreview audience="guest" /></MemoryRouter>);
  expect(await screen.findByRole("heading", { name: "Care Partner" })).toBeTruthy();
  expect(screen.getByText("Child Care / Babysitting")).toBeTruthy();
  expect(screen.getByText("Accepting requests")).toBeTruthy();
  expect(screen.getByText(/2 verified reviews/)).toBeTruthy();
  expect(screen.getByRole("link", { name: "View profile" }).getAttribute("href")).toBe("/caregivers/care-a");
  expect(screen.getByRole("link", { name: /View all caregivers/ }).getAttribute("href")).toBe("/browse");
  expect(screen.getAllByRole("heading", { name: "Care Partner" })).toHaveLength(1);
  expect(apiRequest).toHaveBeenCalledWith("/api/query", expect.objectContaining({
    json: expect.objectContaining({ path: "publicCaregivers", search: { availability: "accepting" } }),
  }));
});

test("signed-in customer preview routes directly to the existing care request", async () => {
  apiRequest.mockImplementation((_url, options) => Promise.resolve(
    options.json.path === "publicCaregivers" ? caregivers([["care-a", profile]]) : services,
  ));
  render(<MemoryRouter initialEntries={["/user/home"]}>
    <Routes>
      <Route path="/user/home" element={<CaregiverPreview audience="customer" />} />
      <Route path="/user/book/:id" element={<p>Existing booking route</p>} />
    </Routes>
  </MemoryRouter>);
  fireEvent.click(await screen.findByRole("button", { name: /Request care/ }));
  expect(screen.getByText("Existing booking route")).toBeTruthy();
});

test("preview shows an honest empty state instead of inventing providers", async () => {
  apiRequest.mockImplementation((_url, options) => Promise.resolve(
    options.json.path === "publicCaregivers" ? caregivers([["care-a", { ...profile, isAvailable: false }]]) : services,
  ));
  render(<MemoryRouter><CaregiverPreview audience="guest" /></MemoryRouter>);
  expect(await screen.findByText(/No caregivers are currently accepting requests/)).toBeTruthy();
  expect(screen.getByRole("link", { name: /Explore caregiver profiles/ }).getAttribute("href")).toBe("/browse?availability=all");
  expect(screen.queryByRole("button", { name: /Sign in to book/ })).toBeNull();
});

test("failed preview requests show retry, not fake caregiver cards", async () => {
  apiRequest.mockImplementation((_url, options) =>
    options.json.path === "publicCaregivers"
      ? Promise.reject(new Error("offline"))
      : Promise.resolve(services),
  );
  render(<MemoryRouter><CaregiverPreview /></MemoryRouter>);
  expect(await screen.findByText("Caregiver profiles could not be loaded.")).toBeTruthy();
  expect(screen.getByRole("status")).toBeTruthy();
  apiRequest.mockImplementation((_url, options) => Promise.resolve(
    options.json.path === "publicCaregivers" ? caregivers([["care-a", profile]]) : services,
  ));
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Care Partner" })).toBeTruthy();
});
