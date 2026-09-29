import { doc, runTransaction, serverTimestamp } from "./d1Client";
import { db } from "./d1Client";


export const reportReceipt = (report) => ({
  bookingId: report.bookingId, reportedBy: report.reportedBy, reason: report.reason,
  status: report.status, createdAt: report.createdAt,
});
// One conduct report per assigned booking. A receipt is a separate, limited
// record so moderator fields never appear in reporter responses.
export async function submitBookingReport(report) {
  const receiptRef = doc(db, "reportReceipts", report.bookingId);
  const lockRef = doc(db, "reportLocks", report.bookingId);
  return runTransaction(db, async (transaction) => {
    const lock = await transaction.get(lockRef);
    if (lock.exists()) return { duplicate: true, id: lock.data().reportId };
    const receipt = await transaction.get(receiptRef);
    if (receipt.exists()) return { duplicate: true, id: receiptRef.id };
    const data = { ...report, status: "pending", createdAt: serverTimestamp() };
    transaction.set(doc(db, "blacklistReports", report.bookingId), data);
    transaction.set(receiptRef, reportReceipt(data));
    transaction.set(lockRef, { reportId: report.bookingId, reportedBy: report.reportedBy });
    return { duplicate: false, id: receiptRef.id };
  });
}
