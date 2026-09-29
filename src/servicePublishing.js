import { getDoc, serverTimestamp, setDoc } from "./d1Client";

import { canonicalCategory } from "./bookingValidation";

export function publicServiceData(id, record) {
  const label = String(record.label || record.serviceName || "").trim();
  if (!label || label.length > 160) throw new Error("Enter a service name of at most 160 characters.");
  return { serviceId: id, label, serviceName: record.serviceName || label, category: canonicalCategory(record.category),
    description: record.description || "", price: record.price ?? 0, isActive: record.isActive !== false, updatedAt: serverTimestamp() };
}
export async function saveService(ref, values, merge = false) {
  const previous = merge ? await getDoc(ref) : null;
  if (merge && !previous.exists()) throw new Error("This service no longer exists.");
  const record = { ...(previous?.data() || {}), ...values, category: canonicalCategory(values.category || previous?.data()?.category) };
  publicServiceData(ref.id, record);
  // The Worker derives the public projection from this authorized source row.
  await setDoc(ref, record);
}
export async function retireService(ref) {
  // Keep historical references recoverable; stop offering the retired service.
  return saveService(ref, { isActive: false, updatedAt: serverTimestamp() }, true);
}
