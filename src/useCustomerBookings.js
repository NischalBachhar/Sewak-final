import { useCallback, useSyncExternalStore } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { normalizeBooking } from "./bookingModel";

const empty = { bookings: [], loading: false, error: "", stale: false };
const stores = new Map();
function storeFor(uid) {
  if (!stores.has(uid)) stores.set(uid, { state: { ...empty, loading: true }, listeners: new Set(), stop: null });
  return stores.get(uid);
}
// Header and customer routes share one listener for the signed-in customer.
// The last subscriber destroys its data, so switching accounts cannot reuse it.
export default function useCustomerBookings(uid) {
  const subscribe = useCallback((listener) => {
    if (!uid) return () => {};
    const store = storeFor(uid); store.listeners.add(listener);
    const publish = (state) => { store.state = state; store.listeners.forEach((notify) => notify()); };
    if (!store.stop) store.stop = onSnapshot(query(collection(db, "bookings"), where("userId", "==", uid)), { includeMetadataChanges: true },
      (snapshot) => publish({ bookings: snapshot.docs.map((item) => normalizeBooking({ id: item.id, ...item.data() })).sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)), loading: false, error: "", stale: snapshot.metadata.fromCache }),
      (error) => publish({ ...store.state, loading: false, error: error.code === "permission-denied" ? "Your account cannot access these bookings." : "Bookings could not be loaded. Reconnect and refresh to retry." }));
    return () => { store.listeners.delete(listener); if (!store.listeners.size) { store.stop?.(); stores.delete(uid); } };
  }, [uid]);
  const getSnapshot = useCallback(() => uid ? storeFor(uid).state : empty, [uid]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
