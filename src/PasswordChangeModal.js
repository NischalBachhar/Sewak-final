// src/components/PasswordChangeModal.js
import React, { useState } from "react";
import "./PasswordChangeModal.css";

const PasswordChangeModal = ({ isOpen, onClose, onPasswordChange }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    // Placeholder: call parent handler if provided
    if (onPasswordChange) {
      onPasswordChange({ currentPassword, newPassword });
    }

    setSuccessMsg("Password changed successfully (dummy handler).");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <div className="password-modal-backdrop">
      <div className="password-modal">
        <div className="password-modal-header">
          <h2>Change Password</h2>
          <button className="close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="password-modal-form">
          {error && <div className="password-modal-error">{error}</div>}
          {successMsg && (
            <div className="password-modal-success">{successMsg}</div>
          )}

          <label>
            Current Password
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </label>

          <label>
            New Password
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </label>

          <label>
            Confirm New Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
          </label>

          <div className="password-modal-actions">
            <button type="button" onClick={onClose} className="secondary-btn">
              Cancel
            </button>
            <button type="submit" className="primary-btn">
              Change Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PasswordChangeModal;
