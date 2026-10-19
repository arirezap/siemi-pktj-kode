import { createContext, useContext, useEffect, useState } from 'react';
import { api, setToken, getToken } from './api.js';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [periode, setPeriode] = useState(null);
  const [loading, setLoading] = useState(true);

  async function muatPeriode() {
    try {
      setPeriode(await api.get('/master/periods/aktif'));
    } catch { /* abaikan */ }
  }

  useEffect(() => {
    (async () => {
      if (!getToken()) return setLoading(false);
      try {
        const { user } = await api.get('/auth/me');
        setUser(user);
        await muatPeriode();
      } catch {
        setToken(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function masuk(email, password) {
    const data = await api.post('/auth/login', { email, password });
    setToken(data.token);
    setUser(data.user);
    await muatPeriode();
    return data.user;
  }

  function keluar() {
    setToken(null);
    setUser(null);
    setPeriode(null);
  }

  const bolehSPM      = ['spm', 'admin'].includes(user?.role);
  const bolehAuditor  = ['auditor', 'spm', 'admin'].includes(user?.role);
  const bolehAuditee  = ['auditee', 'spm', 'admin'].includes(user?.role);
  const bolehPimpinan = ['pimpinan', 'spm', 'admin'].includes(user?.role);

  return (
    <AuthCtx.Provider
      value={{
        user, setUser, periode, setPeriode, loading, masuk, keluar,
        bolehSPM, bolehAuditor, bolehAuditee, bolehPimpinan,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}
