import React, { useEffect, useState, useRef } from "react";
import {
  doc,
  serverTimestamp,
  updateDoc,
} from "./d1Client";
import { db } from "./d1Client";

import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";
import useCustomerBookings from "./useCustomerBookings";
import { getBookingStatus } from "./bookingModel";
import { SkeletonCard, StatusBadge } from "./components/CareExperience";
import { formatNpr } from "./config/brand";

export default function MyBookingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { bookings, loading, error, stale } = useCustomerBookings(user?.uid);
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [completionNotification, setCompletionNotification] = useState(null);
  const prevBookingsRef = useRef([]);
  const initialLoadRef = useRef(true);

  useEffect(() => { prevBookingsRef.current = []; initialLoadRef.current = true; setCompletionNotification(null); }, [user?.uid]);
  useEffect(() => {
    if (loading || error) return undefined;
    let timer;
    if (!initialLoadRef.current && bookings.some((booking) => booking.status === "completed" && prevBookingsRef.current.some((previous) => previous.id === booking.id && previous.status !== "completed"))) {
      setCompletionNotification("A booking has been marked completed."); timer = setTimeout(() => setCompletionNotification(null), 7000);
    }
    prevBookingsRef.current = bookings; initialLoadRef.current = false;
    return () => clearTimeout(timer);
  }, [bookings, loading, error]);

  const cancelBooking = async (booking) => {
    if (!booking || booking.status !== "pending") {
      alert("Only requests waiting for a caregiver can be cancelled here. Please contact Sewak Support for help with accepted or active care.");
      return;
    }

    const confirmCancel = window.confirm(
      "Are you sure you want to cancel this care request? The caregiver has not accepted it yet."
    );
    if (!confirmCancel) return;

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        status: "cancelled",
        updatedAt: serverTimestamp(),
      });
      alert("Booking cancelled successfully.");
    } catch (err) {
      console.error("Error cancelling booking:", { code: err?.code || "unknown" });
      alert("Could not cancel booking. Please try again.");
    }
  };

  const filtered = bookings.filter((b) => {
    const matchStatus = statusFilter ? b.status === statusFilter : true;
    const matchPayment = paymentFilter ? b.paymentStatus === paymentFilter : true;
    return matchStatus && matchPayment;
  });

  if (loading) return <SkeletonCard />;

  if (error)
    return (
      <p style={{ color: "var(--theme-danger)", textAlign: "center", padding: 20 }}>
        Error loading bookings: {error}
      </p>
    );

  const totalSpent = bookings
    .filter((b) => b.paymentStatus === "paid")
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  const completedCount = bookings.filter((b) => b.status === "completed").length;

  return (
    <div className="customer-bookings">
      <div className="customer-bookings__heading">
        <div>
          <p className="customer-bookings__eyebrow">Your care, organized</p>
          <h2 className="section-title section-title--compact">My Bookings</h2>
          <p className="customer-bookings__subtitle">Follow every care request, visit and payment in one place.</p>
        </div>
        <button type="button" className="customer-action customer-action--primary customer-bookings__find-btn" onClick={() => navigate("/user")}>
          Find care <span aria-hidden="true">→</span>
        </button>
      </div>
      {stale && <p role="status">Showing cached bookings. Reconnect for current status.</p>}
      {completionNotification && (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 8,
            backgroundColor: "#e8f5e9",
            border: "1px solid #c8e6c9",
            color: "#256029",
          }}
        >
          {completionNotification}
        </div>
      )}

      {/* Financial totals reflect recorded payment status, not care completion. */}
      {bookings.length > 0 && (
        <section className="customer-booking-stats" aria-label="Booking overview">
          <div className="customer-booking-stats__card"><small>Total bookings</small><strong>{bookings.length}</strong></div>
          <div className="customer-booking-stats__card"><small>Care completed</small><strong>{completedCount}</strong></div>
          <div className="customer-booking-stats__card"><small>Confirmed paid</small><strong>{formatNpr(totalSpent, "NPR 0")}</strong></div>
          <div className="customer-booking-stats__card"><small>Awaiting acceptance</small><strong>{bookings.filter((b) => b.status === "pending").length}</strong></div>
        </section>
      )}

      {/* Filters */}
      <div className="row customer-booking-filters" style={{ marginBottom: 12 }}>
        <div className="col">
          <label>Booking Status</label>
          <select
            className="dropdown-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All bookings</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="col">
          <label>Payment Status</label>
          <select
            className="dropdown-select"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
          >
            <option value="">All payments</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Bookings List */}
      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          &nbsp;
          <p className="empty-state-title">No bookings</p>
          <p className="empty-state-text">
            {bookings.length === 0
              ? "You haven't booked any caregivers yet"
              : "No bookings match this filter"}
          </p>
        </div>
      ) : (
        filtered.map((b) => (
          <div key={b.id} className="card customer-booking-card" style={{ marginBottom: 12 }}>
            {/* Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div>
                <strong className="customer-booking-card__name" style={{ fontSize: 16, color: "var(--theme-text)" }}>
                  {b.caregiverName || "Caregiver"}
                </strong>
                <div style={{ fontSize: 12, color: "var(--theme-text-muted)", marginTop: 4 }}>
                  📍 {b.caregiverLocation || "Location not specified"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <StatusBadge status={b.status} />
                {b.paymentMethod === "fonepay" && (
                  <span
                    style={{
                      background: b.paymentStatus === "paid" ? "var(--theme-positive-soft)" : "var(--theme-warning-soft)",
                      color: b.paymentStatus === "paid" ? "var(--theme-positive)" : "var(--theme-warning)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    💳 {b.paymentStatus === "paid" ? "Paid" : "Pending"}
                  </span>
                )}
                {b.paymentMethod === "cash" && (
                  <span
                    style={{
                      background: "var(--theme-help-soft)",
                      color: "var(--theme-help)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    💵 Cash
                  </span>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="customer-booking-card__details" style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--theme-text)" }}>
              <p style={{ fontSize: 13, color: "var(--theme-text)", marginBottom: 6 }}>
                <strong>📅 Date:</strong> {b.date || "Not specified"}
              </p>
              <p style={{ fontSize: 13, color: "var(--theme-text)", marginBottom: 6 }}>
                <strong>⏰ Time:</strong> {b.time || "Not specified"}
              </p>
              <p style={{ fontSize: 13, color: "var(--theme-text)", marginBottom: 6 }}>
                <strong>⏱️ Duration:</strong> {b.durationHours || "N/A"} hours
              </p>
              <p style={{ fontSize: 13, color: "var(--theme-text)" }}>
                <strong>🏠 Address:</strong> {b.address || "Not specified"}
              </p>
            </div>

            {/* Work Type */}
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 13, color: "var(--theme-text-muted)", marginBottom: 4 }}>
                <strong>Caregiver availability:</strong> {b.caregiverWorkType === "fulltime" ? "Full time" : b.caregiverWorkType === "parttime" ? "Part time" : "Not specified"}
              </p>
            </div>

            {/* Payment Card */}
            <div
              className="customer-booking-card__payment"
              style={{
                marginTop: 12,
                paddingTop: 12,
                paddingBottom: 12,
                paddingLeft: 12,
                paddingRight: 12,
                borderTop: "1px solid var(--theme-text)",
                background: "var(--theme-surface)",
                borderRadius: "8px",
              }}
            >
              <p style={{ fontSize: 13, color: "var(--theme-text)", marginBottom: 6 }}>
                <strong>💰 Amount:</strong> {formatNpr(b.totalAmount || b.amountDue, "To be confirmed")}
              </p>
              {b.paymentMethod === "fonepay" && (
                <>
                  <p style={{ fontSize: 12, color: "var(--theme-text-muted)", marginBottom: 4 }}>
                    <strong>Payment Method:</strong> Fonepay
                  </p>
                  {b.transactionId && (
                    <p style={{ fontSize: 12, color: "var(--theme-text-muted)", marginBottom: 4 }}>
                      <strong>Transaction ID:</strong> {b.transactionId.substring(0, 20)}...
                    </p>
                  )}
                </>
              )}
              {b.paymentMethod === "cash" && b.status !== "completed" && (
                <p style={{ fontSize: 12, color: "var(--theme-warning)" }}>
                  <strong>⚠️ Note:</strong> Please pay {formatNpr(b.totalAmount, "the agreed amount")} in cash to the caregiver
                </p>
              )}
            </div>

            {/* Notes */}
            {b.notes && (
              <p
                className="customer-booking-card__notes"
                style={{
                  fontSize: 13,
                  color: "var(--theme-text-muted)",
                  marginTop: 10,
                  fontStyle: "italic",
                  borderLeft: "3px solid var(--theme-help)",
                  paddingLeft: 10,
                }}
              >
                                <strong>📝 Notes:</strong> {b.notes}
              </p>
            )}

            {/* Booking Info */}
            <div style={{ fontSize: 11, color: "var(--theme-text-muted)", marginTop: 10 }}>
              Booking ID: {b.id.substring(0, 8)}... · Created:{" "}
              {b.createdAt?.toDate?.().toLocaleDateString?.() || "N/A"}
            </div>

            <p style={{ margin: "12px 0 0", color: "var(--theme-text-muted)", fontSize: 12, lineHeight: 1.45 }}>
              <strong>What happens next:</strong> {getBookingStatus(b.status).nextStep}
            </p>

            {/* Actions */}
            <div className="customer-booking-card__actions" style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => navigate(`/user/bookings/${b.id}`)}
                style={{ flex: 1 }}
              >
                {b.status === "completed" ? "Details & review" : "View details"}
              </button>
              {b.status === "pending" && (
                <>
                  <button
                    className="btn btn-outline"
                    onClick={() => cancelBooking(b)}
                    style={{
                      background: "var(--theme-surface)",
                      color: "var(--theme-text)",
                      border: "1px solid var(--theme-text)",
                      flex: 1,
                    }}
                  >
                    Cancel
                  </button>
                  <span style={{ fontSize: 12, color: "var(--theme-text-muted)", alignSelf: "center", flex: 1 }}>
                    ⏳ Waiting for acceptance...
                  </span>
                </>
              )}

              {b.status === "accepted" && (
                <>
                  <span style={{ fontSize: 12, color: "var(--theme-positive)", alignSelf: "center", flex: 1, lineHeight: 1.45 }}>
                    ✓ Accepted. Your caregiver can check in when care begins. For a change to an accepted booking, contact Sewak Support.
                  </span>
                </>
              )}

              {b.status === "completed" && (
                <div>
                  <div style={{ fontSize: 13, color: "var(--theme-positive)", marginBottom: 8 }}>
                    ✓ Completed successfully
                  </div>
                  {b.paymentStatus === "paid" && b.paymentMethod === "fonepay" && (
                    <div style={{ fontSize: 12, color: "var(--theme-help)" }}>
                      ✓ Payment received
                    </div>
                  )}
                </div>
              )}

              {b.status === "cancelled" && (
                <div style={{ fontSize: 13, color: "var(--theme-danger)" }}>✗ Cancelled</div>
              )}
            </div>
          </div>
        ))
      )}

      {bookings.length > 0 && (
        <section className="customer-panel customer-bookings__payment-overview" aria-label="Payment overview">
          <div className="customer-panel__heading">
            <div><p className="customer-eyebrow">Payment transparency</p><h2>Payment overview</h2></div>
          </div>
          <div className="customer-booking-stats">
            <div className="customer-booking-stats__card">
              <small>Paid via Fonepay</small>
              <strong>{formatNpr(bookings.filter((b) => b.paymentMethod === "fonepay" && b.paymentStatus === "paid").reduce((sum, b) => sum + (b.amountPaid || b.totalAmount || 0), 0), "NPR 0")}</strong>
            </div>
            <div className="customer-booking-stats__card">
              <small>Cash awaiting confirmation</small>
              <strong>{formatNpr(bookings.filter((b) => b.paymentMethod === "cash" && b.paymentStatus === "pending").reduce((sum, b) => sum + (b.totalAmount || 0), 0), "NPR 0")}</strong>
            </div>
          </div>
          <p className="customer-bookings__subtitle">Completed care and confirmed payment are tracked separately.</p>
        </section>
      )}

    </div>
  );
}
