import React, { createContext, useContext, useEffect, useState } from 'react';
import { onSessionChanged, refreshSession } from './authClient';
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [accountError, setAccountError] = useState('');
  const [registrationPending, setRegistrationPending] = useState(() => sessionStorage.getItem('sewak.registrationPending') === 'true');
  useEffect(() => onSessionChanged((current, error) => {
    setUser(current); setLoading(false); setAccountError(error ? 'We could not verify your account. Refresh the page and try again.' : '');
  }), []);
  const refreshUserDoc = async () => { await refreshSession(); };
  return <AuthContext.Provider value={{ user, loading, userRole: user?.role || null, userDoc: user?.profile || null, userData: user?.profile || null, accountError, refreshUserDoc,
    registrationPending,
    beginRegistration: role => { sessionStorage.setItem('sewak.registrationRole', role); sessionStorage.setItem('sewak.registrationPending', 'true'); setRegistrationPending(true); },
    finishRegistration: async () => { await refreshUserDoc(); sessionStorage.removeItem('sewak.registrationPending'); sessionStorage.removeItem('sewak.registrationRole'); setRegistrationPending(false); },
  }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('useAuth must be used within AuthProvider'); return value; }
