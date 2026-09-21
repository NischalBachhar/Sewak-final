export function caregiverProfilePatch(values) {
  const allowed = ["name", "phone", "location", "bio", "hourlyRate", "experience"];
  if (Object.keys(values).some((key) => !allowed.includes(key))) throw new Error("Only profile fields may be edited here.");
  const result = Object.fromEntries(allowed.map((key) => [key, ["hourlyRate", "experience"].includes(key) ? Number(values[key]) : String(values[key] || "").trim()]));
  if (result.name.length < 2 || result.name.length > 120 || result.location.length < 2 || result.location.length > 160 || result.phone.length > 40 || result.bio.length > 1000) throw new Error("Enter a valid name and location and keep the profile within its limits.");
  if (!Number.isFinite(result.hourlyRate) || result.hourlyRate < 0 || result.hourlyRate > 1000000 || !Number.isFinite(result.experience) || result.experience < 0 || result.experience > 100) throw new Error("Enter a valid rate and experience.");
  return result;
}
