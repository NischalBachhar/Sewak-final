import React, { useEffect, useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "./firebaseConfig";
import { useAuth } from "./AuthContext";
import { collection, getDocs } from "firebase/firestore";
import { SkeletonCard } from "./components/CareExperience";

const SHIFT_OPTIONS = ["morning", "day", "night"];

export default function CaregiverProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [category, setCategory] = useState("caregiver");
  const [isAvailable, setIsAvailable] = useState(true);
  const [workType, setWorkType] = useState("fulltime");
  const [shifts, setShifts] = useState([]);
  const [servicesOffered, setServicesOffered] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);
  const [hourlyRate, setHourlyRate] = useState(0);
  const [experience, setExperience] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadServices = async () => {
      try {
        const snap = await getDocs(collection(db, "services"));
        const services = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAvailableServices(services);
      } catch (err) {
        console.error("Error loading services:", err);
      }
    };
    loadServices();
  }, []);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      try {
        const ref = doc(db, "vendors", user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data();
          setName(data.name || user.displayName || "");
          setLocation(data.location || "");
          setPhone(data.phone || "");
          setBio(data.bio || "");
          setCategory(data.category || "caregiver");
          setIsAvailable(data.isAvailable ?? true);
          setWorkType(data.workType || "fulltime");
          setShifts(data.shifts || []);
          setServicesOffered(data.servicesOffered || []);
          setHourlyRate(data.hourlyRate || 0);
          setExperience(data.experience || 0);
        } else {
          setName(user.displayName || "");
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Could not load profile");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const toggleArrayValue = (value, current, setter) => {
    if (current.includes(value)) {
      setter(current.filter((v) => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  const handleServiceChange = (id) => {
    toggleArrayValue(id, servicesOffered, setServicesOffered);
  };

  const handleShiftChange = (shift) => {
    toggleArrayValue(shift, shifts, setShifts);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!user) {
      setError("Please sign in");
      return;
    }

    if (!name || !location) {
      setError("Name and location are required");
      return;
    }

    try {
      const finalShifts = workType === "parttime" ? shifts : [];

      const ref = doc(db, "vendors", user.uid);
      const payload = {
        uid: user.uid,
        name,
        location,
        phone,
        bio,
        category,
        isAvailable,
        workType,
        shifts: finalShifts,
        servicesOffered,
        hourlyRate: Number(hourlyRate),
        experience: Number(experience),
        verified: false,
        status: "pending",
        updatedAt: new Date().toISOString(),
      };

      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, payload);
      } else {
        await setDoc(ref, { ...payload, createdAt: new Date().toISOString() });
      }

      // Also update user doc (use setDoc with merge to handle both create/update)
      await setDoc(doc(db, "users", user.uid), {
        name,
        location,
        phone,
        profileComplete: true,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      setSuccess("Profile saved! Waiting for admin verification.");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error saving profile:", err);
      setError("Could not save profile. Please try again.");
    }
  };

  if (loading) {
    return <SkeletonCard variant="dashboard" label="Loading caregiver profile" />;
  }

  return (
    <div>
      <h2 className="section-title section-title--caregiver">Your Profile</h2>

      {error && <div className="error-message">{error}</div>}
      {success && (
        <div
          style={{
            background: "var(--theme-positive-soft)",
            color: "black",
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

      <form onSubmit={handleSave} className="form">
        <label>Full name *</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Your full name"
        />

        <label>Phone number</label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="98XXXXXXXX"
          type="tel"
        />

        <label>Location *</label>
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
          placeholder="e.g., Kathmandu, Lalitpur"
        />

        <label>Bio / About yourself</label>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Tell customers about yourself, your experience, and specialties"
          rows={4}
        />

        <label>Hourly rate (NPR)</label>
        <input
          type="number"
          value={hourlyRate}
          onChange={(e) => setHourlyRate(e.target.value)}
          placeholder="500"
          min="0"
        />

        <label>Years of experience</label>
        <input
          type="number"
          value={experience}
          onChange={(e) => setExperience(e.target.value)}
          placeholder="0"
          min="0"
        />

        <label>Category</label>
        <select 
          value={category} 
          onChange={(e) => setCategory(e.target.value)}
          style={{ color: "black" }}
        >
          <option value="caregiver" style={{ color: "black" }}>Care giver</option>
          <option value="household" style={{ color: "black" }}>Household</option>
        </select>
        {category === "household" && (
          <p style={{ fontSize: 13, color: "var(--theme-warning)", marginTop: 8 }}>
            You can provide both care giving and household services.
          </p>
        )}

        <label style={{ marginTop: 12 }}>Availability</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => setIsAvailable(true)}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: isAvailable ? "none" : "1px solid var(--theme-text)",
              background: isAvailable ? "var(--theme-positive)" : "var(--theme-surface)",
              color: isAvailable ? "white" : "var(--theme-text)",
              cursor: "pointer",
              fontWeight: isAvailable ? "600" : "500",
            }}
          >
            ✓ Available
          </button>
          <button
            type="button"
            onClick={() => setIsAvailable(false)}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: !isAvailable ? "none" : "1px solid var(--theme-text)",
              background: !isAvailable ? "var(--theme-danger)" : "var(--theme-surface)",
              color: !isAvailable ? "white" : "var(--theme-text)",
              cursor: "pointer",
              fontWeight: !isAvailable ? "600" : "500",
            }}
          >
            ✗ Not available
          </button>
        </div>

        <label style={{ marginTop: 12 }}>Work type</label>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => {
              setWorkType("fulltime");
              setShifts([]);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: workType === "fulltime" ? "none" : "1px solid var(--theme-text)",
              background: workType === "fulltime" ? "var(--theme-help)" : "var(--theme-surface)",
              color: workType === "fulltime" ? "white" : "var(--theme-text)",
              cursor: "pointer",
              fontWeight: workType === "fulltime" ? "600" : "500",
            }}
          >
                        💼 Full time
          </button>
          <button
            type="button"
            onClick={() => setWorkType("parttime")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: workType === "parttime" ? "none" : "1px solid var(--theme-text)",
              background: workType === "parttime" ? "var(--theme-warning)" : "var(--theme-surface)",
              color: workType === "parttime" ? "white" : "var(--theme-text)",
              cursor: "pointer",
              fontWeight: workType === "parttime" ? "600" : "500",
            }}
          >
            ⏰ Part time
          </button>
        </div>

        {/* ONLY show shifts for parttime */}
        {workType === "parttime" && (
          <>
            <label style={{ marginTop: 12 }}>Preferred shifts</label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {SHIFT_OPTIONS.map((s) => (
                <label
                  key={s}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13,
                    cursor: "pointer",
                    padding: "6px 12px",
                    borderRadius: "999px",
                    background: shifts.includes(s) ? "var(--theme-help)" : "var(--theme-surface)",
                    border: "1px solid " + (shifts.includes(s) ? "var(--theme-help)" : "var(--theme-border)"),
                    color: "black",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={shifts.includes(s)}
                    onChange={() => handleShiftChange(s)}
                    style={{ cursor: "pointer" }}
                  />
                  {s === "morning" ? "🌅 Morning" : s === "day" ? "☀️ Day" : "🌙 Night"}
                </label>
              ))}
            </div>
          </>
        )}

        {/* Services offered as checkboxes */}
        <label style={{ marginTop: 12 }}>Services you offer</label>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {availableServices.length === 0 ? (
            <p style={{ fontSize: 12, color: "black" }}>
              No services available yet. Contact admin to add services.
            </p>
          ) : (
            availableServices.map((s) => (
              <label
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "6px 12px",
                  borderRadius: "999px",
                  background: servicesOffered.includes(s.id) ? "var(--theme-positive)" : "var(--theme-surface)",
                  border: "1px solid " + (servicesOffered.includes(s.id) ? "var(--theme-positive)" : "var(--theme-border)"),
                  color: "black",
                }}
              >
                <input
                  type="checkbox"
                  checked={servicesOffered.includes(s.id)}
                  onChange={() => handleServiceChange(s.id)}
                  style={{ cursor: "pointer" }}
                />
                {s.label}
              </label>
            ))
          )}
        </div>

        <button
          className="btn btn-primary"
          type="submit"
          style={{ marginTop: 16, alignSelf: "flex-start" }}
        >
          Save profile
        </button>
      </form>

      {/* Profile completion note */}
      <div
        style={{
          marginTop: 24,
          padding: 16,
          background: "var(--theme-surface)",
          border: "1px solid var(--theme-text)",
          borderRadius: 8,
        }}
      >
        <h4 style={{ color: "black", marginTop: 0, marginBottom: 8 }}>
          📝 Profile Completion
        </h4>
        <p style={{ fontSize: 13, color: "black", margin: "0 0 8px 0" }}>
          Complete your profile to appear in caregiver listings:
        </p>
        <ul style={{ fontSize: 12, color: "black", paddingLeft: 20, margin: 0 }}>
          <li style={{ color: "black" }}>
            {name ? "✓" : "○"} Full name
          </li>
          <li style={{ color: "black" }}>
            {location ? "✓" : "○"} Location
          </li>
          <li style={{ color: "black" }}>
            {phone ? "✓" : "○"} Phone number
          </li>
          <li style={{ color: "black" }}>
            {hourlyRate > 0 ? "✓" : "○"} Hourly rate
          </li>
          <li style={{ color: "black" }}>
            {servicesOffered.length > 0 ? "✓" : "○"} At least one service
          </li>
          <li style={{ color: "black" }}>
            ⏳ Admin verification required
          </li>
        </ul>
      </div>
    </div>
  );
}
