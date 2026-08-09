import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { addDoc, collection, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { validatePaymentResponse } from "./fonepayConfig";

export default function PaymentCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing your payment...");

  useEffect(() => {
    const processPayment = async () => {
      try {
        // Get payment response from URL params
        const refId = searchParams.get("refId");
        const amount = searchParams.get("amount");
        const status = searchParams.get("status");
        const transactionId = searchParams.get("transactionId");

        // Validate response
        if (!validatePaymentResponse({ refId, amount })) {
          setStatus("error");
          setMessage("Invalid payment response. Please contact support.");
          return;
        }

        // Get pending booking data from session storage
        const pendingBookingData = sessionStorage.getItem("pendingBookingData");
        if (!pendingBookingData) {
          setStatus("error");
          setMessage("Booking data not found. Please try again.");
          return;
        }

        const bookingData = JSON.parse(pendingBookingData);

        // Check if payment was successful
        if (status === "success" || status === "COMPLETED") {
          // Create booking with payment info
          const docRef = await addDoc(collection(db, "bookings"), {
            ...bookingData,
            paymentMethod: "fonepay",
            paymentStatus: "paid",
            transactionId: transactionId || refId,
            amountPaid: Number(amount),
            paymentDate: serverTimestamp(),
            createdAt: serverTimestamp(),
          });

          // Update vendor earnings
          if (bookingData.vendorId) {
            const vendorRef = doc(db, "vendors", bookingData.vendorId);
            await updateDoc(vendorRef, {
              totalEarnings: (bookingData.vendorEarnings || 0),
              jobsCompleted: 1,
            });
          }

          // Clear session storage
          sessionStorage.removeItem("pendingBookingData");

          setStatus("success");
          setMessage("Payment successful! Your booking has been confirmed.");

          // Redirect after 3 seconds
          setTimeout(() => {
            navigate("/user");
          }, 3000);
        } else {
          setStatus("error");
          setMessage("Payment failed. Please try again.");
          
          // Redirect after 5 seconds
          setTimeout(() => {
            navigate("/user");
          }, 5000);
        }
      } catch (err) {
        console.error("Payment processing error:", err);
        setStatus("error");
        setMessage("Error processing payment. Please contact support.");
      }
    };

    processPayment();
  }, [searchParams, navigate]);

  return (
    <div className="app-shell">
      <div className="app-card" style={{ maxWidth: 500, textAlign: "center" }}>
        {status === "processing" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h2 style={{ color: "var(--theme-button-text)", marginBottom: 8 }}>Processing Payment</h2>
            <p style={{ color: "var(--theme-text-muted)", fontSize: 14 }}>{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ color: "var(--theme-positive)", marginBottom: 8 }}>Payment Successful!</h2>
            <p style={{ color: "var(--theme-button-text)", fontSize: 14, marginBottom: 16 }}>{message}</p>
            <div
              style={{
                background: "var(--theme-positive-soft)",
                padding: 12,
                borderRadius: 8,
                fontSize: 13,
                color: "var(--theme-positive)",
              }}
            >
              You will be redirected to your bookings...
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
            <h2 style={{ color: "var(--theme-danger)", marginBottom: 8 }}>Payment Failed</h2>
            <p style={{ color: "var(--theme-button-text)", fontSize: 14, marginBottom: 16 }}>{message}</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate("/user")}
              style={{ marginTop: 12 }}
            >
              Back to Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}
