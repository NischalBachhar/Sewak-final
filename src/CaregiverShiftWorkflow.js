import React, { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebaseConfig";
import {
  addCareTask,
  addCareUpdate,
  completeCareTask,
  finishCareSession,
  startCareSession,
} from "./careSessionService";
import { ActiveCareCard, CareChecklist, SkeletonCard } from "./components/CareExperience";
import "./CaregiverShiftWorkflow.css";

export default function CaregiverShiftWorkflow({ booking, caregiverId }) {
  const [session, setSession] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [taskLabel, setTaskLabel] = useState("");
  const [updateMessage, setUpdateMessage] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!booking?.id) return undefined;
    const sessionRef = doc(db, "careSessions", booking.id);
    const subscribers = [
      onSnapshot(sessionRef, (snapshot) => {
        setSession(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
        setLoaded(true);
      }, () => setLoaded(true)),
      onSnapshot(query(collection(sessionRef, "tasks"), orderBy("createdAt", "asc")), (snapshot) => setTasks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setTasks([])),
      onSnapshot(query(collection(sessionRef, "updates"), orderBy("createdAt", "desc")), (snapshot) => setUpdates(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))), () => setUpdates([])),
    ];
    return () => subscribers.forEach((unsubscribe) => unsubscribe());
  }, [booking?.id]);

  const run = async (task) => {
    setWorking(true);
    setError("");
    try {
      await task();
    } catch (workflowError) {
      setError(workflowError.message || "We could not update this care session.");
    } finally {
      setWorking(false);
    }
  };

  if (booking.status === "accepted" && !session) {
    return (
      <div className="caregiver-shift-workflow">
        {error ? <p className="error-message">{error}</p> : null}
        <p className="caregiver-shift-workflow__hint">Start the session only once you have arrived. Check-in time is recorded automatically.</p>
        <button type="button" className="btn btn-primary" disabled={working} onClick={() => run(() => startCareSession({ booking, caregiverId }))}>
          {working ? "Checking in…" : "I've arrived / Check in"}
        </button>
      </div>
    );
  }

  if (booking.status !== "in_progress") return null;
  if (!loaded) return <SkeletonCard />;
  if (!session) return <p className="caregiver-shift-workflow__hint">The booking is active, but no care session has been recorded yet.</p>;

  return (
    <section className="caregiver-shift-workflow" aria-label="Care shift workflow">
      {error ? <p className="error-message">{error}</p> : null}
      <ActiveCareCard
        session={session}
        status={session.status}
        caregiverName={booking.caregiverName}
        service={booking.serviceLabel || booking.caregiverCategory}
        tasks={tasks}
        updates={updates}
        showTaskEmptyState
        carePlanHeading="Care log"
        updatesHeading="Updates shared with the family"
      />
      <div className="caregiver-shift-workflow__forms">
        <form onSubmit={(event) => { event.preventDefault(); run(async () => { await addCareTask({ bookingId: booking.id, caregiverId, label: taskLabel }); setTaskLabel(""); }); }}>
          <label htmlFor={`care-task-${booking.id}`}>Add a care task</label>
          <div><input id={`care-task-${booking.id}`} value={taskLabel} maxLength={120} onChange={(event) => setTaskLabel(event.target.value)} placeholder="For example, meal assistance" /><button type="submit" className="btn btn-outline" disabled={working || !taskLabel.trim()}>Add</button></div>
        </form>
        <form onSubmit={(event) => { event.preventDefault(); run(async () => { await addCareUpdate({ bookingId: booking.id, caregiverId, message: updateMessage }); setUpdateMessage(""); }); }}>
          <label htmlFor={`care-update-${booking.id}`}>Share a care update</label>
          <div><input id={`care-update-${booking.id}`} value={updateMessage} maxLength={500} onChange={(event) => setUpdateMessage(event.target.value)} placeholder="For example, morning walk completed" /><button type="submit" className="btn btn-outline" disabled={working || !updateMessage.trim()}>Share</button></div>
        </form>
      </div>
      {tasks.length ? <CareChecklist tasks={tasks} heading="Mark completed tasks" onTaskSelect={(task) => run(() => completeCareTask({ bookingId: booking.id, taskId: task.id, caregiverId, completed: task.status !== "completed" }))} /> : null}
      <button type="button" className="btn caregiver-shift-workflow__finish" disabled={working} onClick={() => run(() => finishCareSession({ bookingId: booking.id }))}>
        {working ? "Finishing shift…" : "Finish shift / Check out"}
      </button>
    </section>
  );
}
