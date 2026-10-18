import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "./HomePage";
import { loadServiceOptions } from "./components/ServiceSelector";

// Jest in CRA predates the react-router-dom v7 export map; use the core router.
jest.mock("react-router-dom", () => {
  global.TextEncoder = require("util").TextEncoder;
  global.TextDecoder = require("util").TextDecoder;
  return jest.requireActual("react-router");
});

jest.mock("./components/PublicHeader", () => ({ __esModule: true, default: () => null }));
jest.mock("./components/CaregiverPreview", () => ({ __esModule: true, default: () => <section aria-label="Caregiver preview" /> }));
jest.mock("./components/ServiceSelector", () => ({ loadServiceOptions: jest.fn() }));

test("homepage service cards deep link to a concrete care filter", async () => {
  loadServiceOptions.mockResolvedValueOnce([
    { id: "catalog_child_care", label: "Child Care / Babysitting", category: "caregiver" },
  ]);
  render(<MemoryRouter><HomePage /></MemoryRouter>);
  const link = await screen.findByRole("link", { name: "Find care for Child Care / Babysitting" });
  expect(link.getAttribute("href")).toBe("/browse?service=catalog_child_care");
  expect(screen.getByRole("region", { name: "Caregiver preview" })).toBeTruthy();
});
