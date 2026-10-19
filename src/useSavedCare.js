import { useCallback, useEffect, useState } from 'react';
import { useOptionalAuth } from './AuthContext';
import { readSavedCare, savedCareEvent, savedCareKey, toggleSavedCare } from './savedCareStore';
export default function useSavedCare() {
  const { user, userRole } = useOptionalAuth() || {};
  const uid = userRole === 'user' ? user?.uid : null;
  const [saved, setSaved] = useState(() => readSavedCare(uid));
  useEffect(() => {
    const update = () => setSaved(readSavedCare(uid));
    update();
    const storage = event => { if (event.key === savedCareKey(uid)) update(); };
    window.addEventListener(savedCareEvent, update);
    window.addEventListener('storage', storage);
    return () => { window.removeEventListener(savedCareEvent, update); window.removeEventListener('storage', storage); };
  }, [uid]);
  const toggle = useCallback(id => toggleSavedCare(uid, id), [uid]);
  return { saved, toggle, enabled: Boolean(uid) };
}
