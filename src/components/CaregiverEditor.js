import ServiceSelector from './ServiceSelector';
import NepalCitySelect from './NepalCitySelect';
import React, { useState } from "react";
import { doc, runTransaction, serverTimestamp } from "../d1Client";
import { db } from "../d1Client";

import { caregiverProfilePatch } from "../caregiverProfile";
import AccessibleDialog from "./AccessibleDialog";
import { uploadProfileImage } from "../profileImages";

export default function CaregiverEditor({ caregiver, onClose, onSaved }) {
  const [values, setValues] = useState(() => Object.fromEntries(["name", "phone", "location", "bio", "hourlyRate", "experience"].map((key) => [key, caregiver[key] ?? (["hourlyRate", "experience"].includes(key) ? 0 : "")])));
  const [category, setCategory] = useState(caregiver.category || 'caregiver');
  const [offered, setOffered] = useState(caregiver.servicesOffered || []);
  const [workType, setWorkType] = useState((caregiver.workType || 'parttime').replace('_',''));
  const [shifts, setShifts] = useState(caregiver.shifts || []);
  const [available, setAvailable] = useState(caregiver.isAvailable === true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (event) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    try {
      const patch = { ...caregiverProfilePatch(values), category, servicesOffered: offered, workType, shifts: workType === "fulltime" ? [] : shifts, isAvailable: available };
      await runTransaction(db, async (transaction) => {
        const ref = doc(db, "vendors", caregiver.id);
        const snapshot = await transaction.get(ref);
        if (!snapshot.exists()) throw new Error("This caregiver no longer exists.");
        const current = snapshot.data();
        if (Object.keys(patch).some((key) => JSON.stringify(current[key] ?? "") !== JSON.stringify(caregiver[key] ?? ""))) throw new Error("This profile changed. Close the editor, refresh, and try again.");
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
        <label>Profile photo<input type="file" accept="image/jpeg,image/webp,image/png" disabled={saving} onChange={async (event) => {
          const file = event.target.files?.[0]; if (!file) return;
          setSaving(true); setError("");
          try { await uploadProfileImage(caregiver.id, file); }
          catch (failure) { setError(failure.message); }
          finally { setSaving(false); }
        }} /></label>
        {[["name", "Name"], ["phone", "Phone"], ["bio", "Biography"], ["hourlyRate", "Hourly rate (NPR)"], ["experience", "Experience (years)"]].map(([key, label]) => <label key={key}>{label}<input value={values[key]} onChange={(event) => setValues({ ...values, [key]: event.target.value })} type={["hourlyRate", "experience"].includes(key) ? "number" : "text"} maxLength={key === "bio" ? 1000 : 160} /></label>)}
        <NepalCitySelect value={values.location} onChange={location => setValues({ ...values, location })} />
        <label>Category<select value={category} onChange={event => setCategory(event.target.value)}><option value="caregiver">Caregiver Support</option><option value="household">Household Support</option><option value="both">Care + household</option></select></label>
        <ServiceSelector value={offered} onChange={setOffered} category={category} organizationId={caregiver.organizationId} />
        <label>Work type<select value={workType} onChange={event => setWorkType(event.target.value)}><option value="parttime">Part time</option><option value="fulltime">Full time</option></select></label>
        {workType === 'parttime' && <fieldset><legend>Shifts</legend>{['morning','day','evening','night'].map(shift => <label key={shift}><input type="checkbox" checked={shifts.includes(shift)} onChange={event => setShifts(event.target.checked ? [...shifts,shift] : shifts.filter(item => item !== shift))} />{shift}</label>)}</fieldset>}
        <label><input type="checkbox" checked={available} onChange={event => setAvailable(event.target.checked)} />Available for bookings</label>
        <button className="btn btn-primary" disabled={saving} type="submit">{saving ? "Saving…" : "Save profile"}</button>
        <button className="btn btn-outline" disabled={saving} type="button" onClick={onClose}>Cancel</button>
      </form>
    </section>
  </AccessibleDialog>;
}
