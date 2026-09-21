import React, { useState } from "react";
import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { caregiverProfilePatch } from "../caregiverProfile";
import AccessibleDialog from "./AccessibleDialog";

export default function CaregiverEditor({ caregiver, onClose, onSaved }) {
  const [values, setValues] = useState(() => Object.fromEntries(["name", "phone", "location", "bio", "hourlyRate", "experience"].map((key) => [key, caregiver[key] ?? (["hourlyRate", "experience"].includes(key) ? 0 : "")])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (event) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    try {
      const patch = caregiverProfilePatch(values);
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "vendors", caregiver.id);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("This caregiver no longer exists.");
        const current = snapshot.data();
        if (Object.keys(patch).some((key) => (current[key] ?? "") !== (caregiver[key] ?? ""))) throw new Error("This profile changed. Close the editor, refresh, and try again.");
        transaction.update(ref, { ...patch, updatedAt: serverTimestamp() });
      });
      onSaved({ ...caregiver, ...patch });
    } catch (err) { setError(err.code === "permission-denied" ? "You do not have permission to edit this caregiver." : err.message); }
    finally { setSaving(false); }
  };
  return <AccessibleDialog onDismiss={() => !saving && onClose()} className="sewak-dialog-backdrop">
    <section className="sewak-dialog-panel">
      <h2>Edit caregiver profile</h2>
      {error && <p role="alert">{error}</p>}
      <form className="form" onSubmit={save}>
        {[["name", "Name"], ["phone", "Phone"], ["location", "Location"], ["bio", "Biography"], ["hourlyRate", "Hourly rate (NPR)"], ["experience", "Experience (years)"]].map(([key, label]) => <label key={key}>{label}<input value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} type={["hourlyRate", "experience"].includes(key) ? "number" : "text"} maxLength={key === "bio" ? 1000 : 160} /></label>)}
        <button className="btn btn-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save profile"}</button>
        <button className="btn btn-outline" disabled={saving} type="button" onClick={onClose}>Cancel</button>
      </form>
    </section>
  </AccessibleDialog>;
}
