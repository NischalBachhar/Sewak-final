import React, { useState } from "react";
import { kathmanduDate } from "../bookingValidation";

/** Presentation-only weekly view of real scheduled bookings. */
const localKey = (date) => date.toISOString().slice(0,10);

function mondayOf(value) {
  const day = new Date(value);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day;
}

export default function CareWeekPreview({ bookings = [] }) {
  const [offset, setOffset] = useState(0);
  const todayKey = kathmanduDate();
  const monday = mondayOf(new Date(todayKey+'T00:00:00Z'));
  monday.setUTCDate(monday.getUTCDate() + offset * 7);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    const key = localKey(date);
    const count = bookings.filter((booking) => booking.date === key).length;
    return { date, key, count };
  });
  const friday = dates[6].date;
  const title = monday.toLocaleDateString("en-NP", { timeZone:'UTC', month: "short", day: "numeric" }) +
    " – " + friday.toLocaleDateString("en-NP", { timeZone:'UTC', month: "short", day: "numeric", year: "numeric" });

  return (
    <section className="sewak-week" aria-label="Weekly accepted care overview">
      <div className="sewak-week__head">
        <div><p className="sewak-week__eyebrow">CALENDAR</p><h4>Week at a glance</h4><p>Accepted and in-progress care only</p></div>
        <div className="sewak-week__controls">
          <button type="button" aria-label="Previous week" onClick={() => setOffset((current) => current - 1)}>‹</button>
          <span aria-live="polite">{title}</span>
          <button type="button" aria-label="Next week" onClick={() => setOffset((current) => current + 1)}>›</button>
          {offset !== 0 && <button type="button" className="sewak-week__today" onClick={() => setOffset(0)}>This week</button>}
        </div>
      </div>
      <div className="sewak-week__days">
        {dates.map(({ date, key, count }) => (
          <div key={key} role="group" aria-label={'Care schedule for '+key} aria-current={key===todayKey?'date':undefined} className={"sewak-week__day" + (key === todayKey ? " is-today" : "")}>
            <span>{date.toLocaleDateString("en-NP", { timeZone:'UTC', weekday: "short" })}</span>
            <strong>{date.getUTCDate()}</strong>
            <small>{count ? count + " care " + (count === 1 ? "visit" : "visits") : "No visits"}</small>
          </div>
        ))}
      </div>
      <p className="sewak-week__foot">Dates use Nepal time. Your complete upcoming booking list appears below, including dates beyond this week.</p>
    </section>
  );
}
