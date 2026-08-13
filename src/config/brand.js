export const BRAND = {
  name: "Sewak",
  tagline: "Care, close to home",
  description:
    "Find trusted caregivers and household support with clear next steps for your family.",
  supportLabel: "Contact Sewak Support",
};

export const formatNpr = (amount, fallback = "On request") => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) return fallback;

  return `NPR ${new Intl.NumberFormat("en-NP", {
    maximumFractionDigits: 0,
  }).format(numericAmount)}`;
};
