import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  updatePassword,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebaseConfig";
import { useAuth } from "./AuthContext";
import { useNavigate } from "react-router-dom";

export default function UserProfilePage() {
  const { user, userDoc, refreshUserDoc } = useAuth(); 
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [shouldNavigate, setShouldNavigate] = useState(false);

  // Profile picture upload
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);

  // Change password
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;

      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setName(data.name || "");
          setPhone(data.phone || "");
          setAddress(data.address || "");
          setCity(data.city || "");
          setProfilePicture(data.profilePicture || user.photoURL || "");
          setImagePreview(data.profilePicture || user.photoURL || null);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Could not load profile");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  // Watch for profile completion and navigate
  useEffect(() => {
    if (shouldNavigate && userDoc?.profileComplete) {
      console.log("Profile complete, navigating to browse");
      navigate("/user");
    }
  }, [userDoc?.profileComplete, shouldNavigate, navigate]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image size must be less than 2MB");
      return;
    }

    setImageFile(file);
    setError(""); // Clear any previous errors

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const uploadProfilePicture = async () => {
    if (!imageFile) return profilePicture;

    try {
      setUploadingImage(true);

      // Upload to Firebase Storage
      const storageRef = ref(
        storage,
        `profile_pictures/${user.uid}_${Date.now()}.jpg`,
      );
      await uploadBytes(storageRef, imageFile);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update Firebase Auth profile
      await updateProfile(user, {
        photoURL: downloadURL,
      });

      return downloadURL;
    } catch (err) {
      console.error("Error uploading image:", err);
      throw new Error("Could not upload profile picture");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!name || !phone || !address || !city) {
      setError("All fields are required");
      return;
    }

    // Validate phone
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 10) {
      setError("Please enter a valid 10-digit phone number");
      return;
    }

    try {
      setSubmitting(true);

      // Upload profile picture if new image selected
      let finalProfilePicture = profilePicture;
      if (imageFile) {
        finalProfilePicture = await uploadProfilePicture();
      }

      // Update or create Firestore document (use setDoc with merge to handle both cases)
      await setDoc(doc(db, "users", user.uid), {
        name,
        phone,
        address,
        city,
        profilePicture: finalProfilePicture,
        profileComplete: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Update Firebase Auth display name
      await updateProfile(user, {
        displayName: name,
      });

      setProfilePicture(finalProfilePicture);
      setImageFile(null); // Clear file after successful upload
      setSuccess("Profile saved successfully!");

      // Refresh user context to update profileComplete status
      await refreshUserDoc();
      
      // Set flag to trigger navigation when userDoc updates
      setShouldNavigate(true);
    } catch (err) {
      console.error("Error saving profile:", err);
      setError(err.message || "Could not save profile. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill all password fields");
      return;
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    try {
      setChangingPassword(true);

      // Re-authenticate user first
      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword,
      );
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      setSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordSection(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error changing password:", err);
      if (err.code === "auth/wrong-password") {
        setError("Current password is incorrect");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many attempts. Please try again later.");
      } else if (err.code === "auth/requires-recent-login") {
        setError("Please log out and log back in before changing password");
      } else {
        setError(err.message || "Could not change password");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading)
    return (
      <p style={{ color: "var(--theme-text-muted)", textAlign: "center", padding: 20 }}>
        Loading profile...
      </p>
    );


  return (
    <div className="app-shell">
      <div className="app-card" style={{ maxWidth: 700 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ color: "var(--theme-text)", fontSize: 24, marginBottom: 8 }}>
            My Profile
          </h1>
          <p style={{ fontSize: 13, color: "var(--theme-text-muted)", margin: 0 }}>
            {!userDoc?.profileComplete
              ? "Complete your profile to start booking caregivers"
              : "Update your profile information"}
          </p>
        </div>

        {/* Mandatory Notice */}
        {!userDoc?.profileComplete && (
          <div
            style={{
              background: "var(--theme-help-soft)",
              color: "var(--theme-help)",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
              border: "1px solid var(--theme-help-light)",
            }}
          >
            <strong>ℹ️ Required:</strong> Your profile information will be used
            to auto-fill booking forms.
          </div>
        )}

        {error && <div className="error-message">{error}</div>}
        {success && (
          <div
            style={{
              background: "var(--theme-positive-soft)",
              color: "var(--theme-positive)",
              padding: 12,
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
              border: "1px solid var(--theme-positive-soft)",
            }}
          >
            ✓ {success}
          </div>
        )}

        {/* Profile Picture Section */}
        <div
          className="card"
          style={{ marginBottom: 16, background: "var(--theme-surface)" }}
        >
          <h3 style={{ color: "var(--theme-text)", marginTop: 0, marginBottom: 12 }}>
            Profile Picture
          </h3>

          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {/* Current/Preview Image */}
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: imagePreview ? "transparent" : "var(--theme-help)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                border: "2px solid var(--theme-text)",
              }}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
                  alt="Profile"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span
                  style={{ fontSize: 40, color: "white", fontWeight: "bold" }}
                >
                  {name ? name[0].toUpperCase() : "?"}
                </span>
              )}
            </div>

            {/* Upload Button */}
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
                id="profile-picture-upload"
              />
              <label
                htmlFor="profile-picture-upload"
                className="btn btn-outline"
                style={{
                  display: "inline-block",
                  cursor: "pointer",
                  background: "var(--theme-surface)",
                  color: "var(--theme-text)",
                  border: "1px solid var(--theme-text)",
                  padding: "10px 16px",
                  borderRadius: "6px",
                  marginBottom: 8,
                }}
              >
                📷 {imagePreview ? "Change Photo" : "Upload Photo"}
              </label>
              <p style={{ fontSize: 11, color: "var(--theme-text-muted)", margin: 0 }}>
                Max size: 2MB • Formats: JPG, PNG, GIF
              </p>
              {uploadingImage && (
                <p style={{ fontSize: 12, color: "var(--theme-warning)", marginTop: 4 }}>
                  Uploading image...
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Profile Information Form */}
        <form onSubmit={handleSave} className="form">
          <label>Full Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="Your full name"
          />

          <label>Phone Number *</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            placeholder="98XXXXXXXX"
            maxLength={10}
          />

          <label>Address *</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="House/Apt, Street, Area"
          />

          <label>City *</label>
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          >
            <option value="">Select city</option>
            <option value="Kathmandu">Kathmandu</option>
            <option value="Lalitpur">Lalitpur</option>
            <option value="Bhaktapur">Bhaktapur</option>
            <option value="Pokhara">Pokhara</option>
            <option value="Biratnagar">Biratnagar</option>
            <option value="Birgunj">Birgunj</option>
            <option value="Butwal">Butwal</option>
            <option value="Dharan">Dharan</option>
            <option value="Other">Other</option>
          </select>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || uploadingImage}
            style={{ marginTop: 16 }}
          >
            {submitting
              ? "Saving..."
              : uploadingImage
                ? "Uploading..."
                : "Save Profile"}
          </button>
        </form>

        {/* Change Password Section */}
        <div className="card" style={{ marginTop: 24, background: "var(--theme-surface)" }}>
          <h3 style={{ color: "var(--theme-text)", marginTop: 0, marginBottom: 12 }}>
            Change Password
          </h3>

          {!showPasswordSection ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => setShowPasswordSection(true)}
              style={{
                background: "var(--theme-surface)",
                color: "var(--theme-text)",
                border: "1px solid var(--theme-text)",
              }}
            >
              🔒 Change Password
            </button>
          ) : (
            <form onSubmit={handleChangePassword} className="form">
              <label>Current Password *</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
              />

              <label>New Password *</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
              />

              <label>Confirm New Password *</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Re-enter new password"
              />

              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={changingPassword}
                  style={{ flex: 1 }}
                >
                  {changingPassword ? "Changing..." : "Update Password"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => {
                    setShowPasswordSection(false);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setError("");
                  }}
                  style={{
                    flex: 1,
                    background: "var(--theme-surface)",
                    color: "var(--theme-text)",
                    border: "1px solid var(--theme-text)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Profile Completion Indicator */}
        <div
          style={{
            marginTop: 24,
            padding: 16,
            background: "var(--theme-surface)",
            border: "1px solid var(--theme-text)",
            borderRadius: 8,
          }}
        >
          <h4 style={{ color: "var(--theme-text)", marginTop: 0, marginBottom: 12 }}>
            Profile Completion
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: name ? "var(--theme-positive)" : "var(--theme-text-muted)" }}>
                {name ? "✓" : "○"}
              </span>
              <span
                style={{ fontSize: 13, color: name ? "var(--theme-positive)" : "var(--theme-text-muted)" }}
              >
                Full name
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: phone ? "var(--theme-positive)" : "var(--theme-text-muted)" }}>
                {phone ? "✓" : "○"}
              </span>
              <span
                style={{ fontSize: 13, color: phone ? "var(--theme-positive)" : "var(--theme-text-muted)" }}
              >
                Phone number
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: address ? "var(--theme-positive)" : "var(--theme-text-muted)" }}>
                {address ? "✓" : "○"}
              </span>
              <span
                style={{ fontSize: 13, color: address ? "var(--theme-positive)" : "var(--theme-text-muted)" }}
              >
                Address
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: city ? "var(--theme-positive)" : "var(--theme-text-muted)" }}>
                {city ? "✓" : "○"}
              </span>
              <span
                style={{ fontSize: 13, color: city ? "var(--theme-positive)" : "var(--theme-text-muted)" }}
              >
                City
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: imagePreview ? "var(--theme-positive)" : "var(--theme-text-muted)" }}>
                {imagePreview ? "✓" : "○"}
              </span>
              <span
                style={{
                  fontSize: 13,
                  color: imagePreview ? "var(--theme-positive)" : "var(--theme-text-muted)",
                }}
              >
                Profile picture (optional)
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div style={{ marginTop: 16 }}>
            {(() => {
              const completed = [name, phone, address, city].filter(
                Boolean,
              ).length;
              const total = 4;
              const percentage = Math.round((completed / total) * 100);

              return (
                <>
                  <div
                    style={{
                      width: "100%",
                      height: 8,
                      background: "var(--theme-border)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${percentage}%`,
                        height: "100%",
                        background: percentage === 100 ? "var(--theme-positive)" : "var(--theme-help)",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--theme-text-muted)",
                      marginTop: 8,
                      textAlign: "center",
                    }}
                  >
                    {percentage}% Complete {percentage === 100 && "🎉"}
                  </p>
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
