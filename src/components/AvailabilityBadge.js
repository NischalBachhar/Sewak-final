import React from "react";

/**
 * "Accepting requests" reflects the caregiver's published request toggle, not
 * real-time presence or an available appointment slot.
 */
export default function AvailabilityBadge({ isAvailable }) {
  const accepting = isAvailable === true;
  return (
    <span
      className={`caregiver-availability ${accepting ? "caregiver-availability--accepting" : "caregiver-availability--unavailable"}`}
      aria-label={accepting ? "Accepting booking requests; dates require confirmation" : "Not accepting booking requests"}
    >
      <span className="caregiver-availability__dot" aria-hidden="true" />
      {accepting ? "Accepting requests" : "Not accepting requests"}
    </span>
  );
}
