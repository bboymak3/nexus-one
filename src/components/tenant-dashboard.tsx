'use client';
import { useState, useEffect, useCallback } from 'react';

interface Toast { id: string; msg: string; type: string; }

export default function TenantDashboard() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<any>(null);
  const [tenant, setTenant] = useState<any>(null);
  const [slug, setSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const addToast = useCallback((msg: string, type: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const api = useCallback(async (url: string, opts?: RequestInit) => {
    const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...opts?.headers } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    return data;
  }, [token]);

  useEffect(() => {
    const t = localStorage.getItem('nexus_token') || '';
    if (!t) { window.location.href = '/'; return; }
    setToken(t);
  }, []);

  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/([a-z0-9-]+)/);
    if (match) setSlug(match[1]);
  }, []);

  useEffect(() => {
    if (!token || !slug) return;
    (async () => {
      try {
        const authData = await api('/api/auth');
        if (authData.userType !== 'tenant' || authData.tenant?.slug !== slug) {
          window.location.href = `/${slug}`; return;
        }
        setUser(authData.user);
        setTenant(authData.tenant);
        // Load users
        const usersData = await api(`/api/tenants/users?tenantId=${authData.tenant.id}`);
        setUsers(usersData.users || []);
      } catch { window.location.href = `/${slug}`; }
      finally { setLoading(false); }
    })();
  }, [token, slug]);

  const handleLogout = () => {
    document.cookie = 'session_token=; path=/; max-age=0';
    localStorage.clear();
    window.location.href = `/${slug}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-2 border-t-transparent rounded-full" style={{borderColor:'var(--accent)',borderTopColor:'transparent'}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg, #8b5cf6, #06b6d4)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/></svg>
            </div>
            <div>
              <span className="font-semibold text-sm">{tenant?.name || 'Mi Negocio'}</span>
              <span className="nexus-badge nexus-badge-green ml-2" style={{fontSize:'10px'}}>{tenant?.plan || 'basic'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs hidden sm:inline" style={{color:'var(--text-secondary)'}}>{user?.fullName}</span>
            <span className="nexus-badge nexus-badge-blue" style={{fontSize:'10px'}}>{user?.role}</span>
            <button onClick={handleLogout} className="nexus-btn nexus-btn-secondary nexus-btn-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Welcome Card */}
        <div className="glass rounded-xl p-6 mb-6 animate-fade animate-glow">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold mb-1">Bienvenido, {user?.fullName || user?.username}</h1>
              <p className="text-sm" style={{color:'var(--text-secondary)'}}>
                Panel de gestion de <strong>{tenant?.name}</strong>
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{color:'var(--text-muted)'}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              URL de acceso: <strong style={{color:'var(--accent)'}}>{typeof window !== 'undefined' ? window.location.origin : ''}/{slug}</strong>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-fade">
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:'rgba(139,92,246,0.15)'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{color:'#8b5cf6'}}>{users.length}</p>
                <p className="text-xs" style={{color:'var(--text-secondary)'}}>Usuarios</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:'rgba(16,185,129,0.15)'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{color:'#10b981'}}>{tenant?.status === 'active' ? 'Activo' : 'Suspendido'}</p>
                <p className="text-xs" style={{color:'var(--text-secondary)'}}>Estado</p>
              </div>
            </div>
          </div>
          <div className="glass rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{background:'rgba(59,130,246,0.15)'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              </div>
              <div>
                <p className="text-2xl font-bold" style={{color:'#3b82f6'}}>{tenant?.d1_database_id ? 'Conectada' : 'Pendiente'}</p>
                <p className="text-xs" style={{color:'var(--text-secondary)'}}>Base de Datos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="glass rounded-xl overflow-hidden animate-fade">
          <div className="p-4 flex items-center justify-between" style={{borderBottom:'1px solid var(--border)'}}>
            <h2 className="text-sm font-semibold">Usuarios del Negocio</h2>
            <span className="text-xs" style={{color:'var(--text-muted)'}}>{users.length} usuario(s)</span>
          </div>
          {users.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm" style={{color:'var(--text-muted)'}}>No hay otros usuarios ademas de ti</p>
            </div>
          ) : (
            <table className="nexus-table">
              <thead>
                <tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Ultimo Login</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td className="font-mono text-xs">{u.username}</td>
                    <td>{u.full_name}</td>
                    <td><span className={`nexus-badge ${u.role === 'admin' ? 'nexus-badge-purple' : u.role === 'cajero' ? 'nexus-badge-green' : 'nexus-badge-blue'}`}>{u.role}</span></td>
                    <td><span className={`nexus-badge ${u.is_active ? 'nexus-badge-green' : 'nexus-badge-red'}`}>{u.is_active ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="text-xs" style={{color:'var(--text-muted)'}}>{u.last_login ? new Date(u.last_login).toLocaleString('es') : 'Nunca'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Connection Info */}
        {!tenant?.d1_database_id && (
          <div className="glass rounded-xl p-5 mt-6 animate-fade" style={{borderColor:'rgba(245,158,11,0.3)'}}>
            <div className="flex items-start gap-3">
              <svg className="flex-shrink-0 mt-0.5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <h3 className="font-semibold text-sm mb-1" style={{color:'#f59e0b'}}>Base de datos no configurada</h3>
                <p className="text-xs" style={{color:'var(--text-secondary)'}}>El super administrador debe crear y asignar una base de datos D1 para este negocio. Contacta al administrador del sistema para completar la configuracion.</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Toasts */}
      {toasts.map(t => (
        <div key={t.id} className={`nexus-toast nexus-toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}