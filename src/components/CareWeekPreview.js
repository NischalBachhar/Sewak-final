import React, { useState } from "react";

/** Presentation-only weekly view of real scheduled bookings. */
const localKey = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

function mondayOf(value) {
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

export default function CareWeekPreview({ bookings = [] }) {
  const [offset, setOffset] = useState(0);
  const monday = mondayOf(new Date());
  monday.setDate(monday.getDate() + offset * 7);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = localKey(date);
    const count = bookings.filter((booking) => booking.date === key).length;
    return { date, key, count };
  });
  const friday = dates[6].date;
  const title = monday.toLocaleDateString("en-NP", { month: "short", day: "numeric" }) +
    " – " + friday.toLocaleDateString("en-NP", { month: "short", day: "numeric", year: "numeric" });
  const todayKey = localKey(new Date());

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
          <div key={key} className={"sewak-week__day" + (key === todayKey ? " is-today" : "")}>
            <span>{date.toLocaleDateString("en-NP", { weekday: "short" })}</span>
            <strong>{date.getDate()}</strong>
            <small>{count ? count + " care " + (count === 1 ? "visit" : "visits") : "No visits"}</small>
          </div>
        ))}
      </div>
      <p className="sewak-week__foot">Your complete upcoming booking list appears below, including dates beyond this week.</p>
    </section>
  );
}
