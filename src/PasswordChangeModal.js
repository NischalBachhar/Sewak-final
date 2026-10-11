import { changePassword } from './authClient';
import AccessibleDialog from "./components/AccessibleDialog";
// src/components/PasswordChangeModal.js
import React, { useState } from "react";
import "./PasswordChangeModal.css";

const PasswordChangeModal = ({ isOpen, onClose, onPasswordChange }) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible,setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
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

    if (saving) return;
    setSaving(true);
    try {
      await (onPasswordChange || (({ currentPassword, newPassword }) => changePassword(currentPassword, newPassword)))({ currentPassword, newPassword });
      setSuccessMsg('Password changed. Please sign in again.');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (error) { setError(error.message || 'Password could not be changed.'); }
    finally { setSaving(false); }
  };

  return (
    <AccessibleDialog onDismiss={onClose} className="password-modal-backdrop">
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
              type={visible ? "text" : "password"} required maxLength={128}
              autoComplete="current-password" value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
            />
          </label>

          <label>
            New Password
            <input
              type={visible ? "text" : "password"}
              minLength={8} maxLength={128} required autoComplete="new-password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
          </label>

          <label>
            Confirm New Password
            <input
              type={visible ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
          </label>

          <p>Use 8?128 characters. Administrator accounts require at least 12.</p><button type="button" aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible ? "Hide passwords" : "Show passwords"}</button>
          <div className="password-modal-actions">
            <button type="button" onClick={onClose} className="secondary-btn">
              Cancel
            </button>
            <button type="submit" className="primary-btn" disabled={saving}>
              Change Password
            </button>
          </div>
        </form>
      </div>
    </AccessibleDialog>
  );
};

export default PasswordChangeModal;
