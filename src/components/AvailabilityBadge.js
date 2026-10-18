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
    >
      <span className="caregiver-availability__dot" aria-hidden="true" />
      {accepting ? "Accepting requests" : "Not accepting requests"}
      {accepting && <span className="caregiver-availability__detail">; dates require confirmation</span>}
    </span>
  );
}
