// Nepal has a fixed UTC+05:45 offset. ISO date keys must not depend on server TZ.
export const nepalDay = (instant:Date = new Date()) =>
  new Date(instant.getTime()+345*60000).toISOString().slice(0,10);
