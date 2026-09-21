import { useEffect, useState } from "react";
import { collection, getAggregateFromServer, count, sum, limit, onSnapshot, orderBy, query, startAfter, where } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { normalizeBooking } from "./bookingModel";

export default function useOrganizationBookings(uid) {
  const [rows, setRows] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [cursors, setCursors] = useState([]);
  const [last, setLast] = useState(null);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [totals, setTotals] = useState({ total: null, completed: null, revenue: null, earnings: null, matching: null });
  useEffect(() => { setCursor(null); setCursors([]); setRows([]); }, [uid, filter]);
  useEffect(() => {
    let active = true;
    setRows([]); setLoading(true); setError("");
    if (!uid) { setLoading(false); return undefined; }
    const base = query(collection(db, "bookings"), where("organizationId", "==", uid));
    const filtered = filter ? query(base, where("status", "==", filter)) : base;
    const refreshTotals = async () => {
      try {
        const completedQuery = query(base, where("status", "==", "completed"));
        const [all, completed, revenue, earnings, matching] = await Promise.all([
          getAggregateFromServer(base, { total: count() }),
          getAggregateFromServer(completedQuery, { completed: count() }),
          getAggregateFromServer(completedQuery, { revenue: sum("totalAmount") }),
          getAggregateFromServer(completedQuery, { earnings: sum("vendorEarnings") }),
          getAggregateFromServer(filtered, { matching: count() }),
        ]);
        if (active) setTotals({ ...all.data(), ...completed.data(), ...revenue.data(), ...earnings.data(), ...matching.data() });
      } catch { if (active) setError("Booking totals could not be refreshed. Refresh to retry."); }
    };
    // Stable document-ID pagination also includes legacy records lacking timestamps.
    const page = query(filtered, orderBy("__name__"), ...(cursor ? [startAfter(cursor)] : []), limit(25));
    const stop = onSnapshot(page, { includeMetadataChanges: true }, (snapshot) => {
      setRows(snapshot.docs.map((item) => normalizeBooking({ id: item.id, ...item.data() })));
      setLast(snapshot.docs.length === 25 ? snapshot.docs[24] : null);
      setStale(snapshot.metadata.fromCache); setLoading(false);
      if (!snapshot.metadata.fromCache) refreshTotals();
    }, (err) => { setLoading(false); setError(err.code === "permission-denied" ? "You do not have access to these bookings." : "Booking history could not be loaded. Reconnect and refresh."); });
    // Page updates refresh immediately; aggregates also refresh changes outside
    // this page without subscribing to every historical booking document.
    const timer = setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) refreshTotals(); }, 30000);
    return () => { active = false; stop(); clearInterval(timer); };
  }, [uid, cursor, filter]);
  return { rows, totals, loading, error, stale, filter, setFilter, hasNext: Boolean(last), hasPrevious: cursors.length > 0,
    next: () => { if (last) { setCursors([...cursors, cursor]); setCursor(last); } },
    previous: () => { setCursor(cursors[cursors.length - 1] || null); setCursors(cursors.slice(0, -1)); },
  };
}
