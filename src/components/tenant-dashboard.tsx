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
  const [openingPos, setOpeningPos] = useState(false);
  const [showPosConfirm, setShowPosConfirm] = useState(false);

  const SUPPORT_WHATSAPP = '584220550136';

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
      // Sesion invalida o de otro negocio: de vuelta al login. Cualquier otra falla
      // (p. ej. no poder listar usuarios de un negocio suspendido) no debe sacar al
      // usuario de su propio panel, solo se ve sin esa lista.
      let authData: any;
      try {
        authData = await api('/api/auth');
        if (authData.userType !== 'tenant' || authData.tenant?.slug !== slug) {
          window.location.href = `/${slug}`; return;
        }
      } catch { window.location.href = `/${slug}`; return; }

      setUser(authData.user);
      setTenant(authData.tenant);
      try {
        const usersData = await api(`/api/tenants/users?tenantId=${authData.tenant.id}`);
        setUsers(usersData.users || []);
      } catch { /* negocio suspendido u otro error: se ve el panel igual, sin la lista */ }
      setLoading(false);
    })();
  }, [token, slug]);

  const handleOpenPos = () => setShowPosConfirm(true);

  const confirmOpenPos = async () => {
    setOpeningPos(true);
    try {
      const data = await api('/api/sso', { method: 'POST' });
      window.location.href = data.url;
    } catch (e: any) {
      addToast(e.message || 'No se pudo abrir el POS', 'error');
      setOpeningPos(false);
      setShowPosConfirm(false);
    }
  };

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
            <div className="flex flex-col items-start sm:items-end gap-2">
              <button onClick={handleOpenPos} disabled={openingPos} className="nexus-btn nexus-btn-primary">
                {openingPos ? <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : 'Abrir Punto de Venta'}
              </button>
              <div className="flex items-center gap-2 text-xs" style={{color:'var(--text-muted)'}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                URL de acceso: <strong style={{color:'var(--accent)'}}>{typeof window !== 'undefined' ? window.location.origin : ''}/{slug}</strong>
              </div>
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
                <p className="text-2xl font-bold" style={{color: tenant?.active !== false ? '#10b981' : '#ef4444'}}>{tenant?.active !== false ? 'Activo' : 'Vencido'}</p>
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
                <p className="text-2xl font-bold" style={{color:'#3b82f6'}}>{user?.role === 'admin' ? 'Admin' : user?.role}</p>
                <p className="text-xs" style={{color:'var(--text-secondary)'}}>Tu rol en el POS</p>
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

      </main>

      {/* Aviso de negocio + estado de licencia antes de abrir el POS */}
      {showPosConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:'rgba(0,0,0,0.7)'}}>
          <div className="glass rounded-2xl p-6 w-full max-w-sm">
            {tenant?.active !== false ? (
              <>
                <div className="text-center mb-5">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{background:'rgba(139,92,246,0.15)'}}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4"/></svg>
                  </div>
                  <p className="text-sm" style={{color:'var(--text-secondary)'}}>Este es su negocio</p>
                  <h2 className="text-lg font-bold mt-1">{tenant?.name}</h2>
                  <span className="nexus-badge nexus-badge-green mt-2 inline-block">Licencia activa</span>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowPosConfirm(false)} className="nexus-btn nexus-btn-secondary flex-1 justify-center" disabled={openingPos}>
                    Cancelar
                  </button>
                  <button onClick={confirmOpenPos} className="nexus-btn nexus-btn-primary flex-1 justify-center" disabled={openingPos}>
                    {openingPos ? <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" /> : 'Aceptar'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-5">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{background:'rgba(239,68,68,0.15)'}}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                  </div>
                  <p className="text-sm" style={{color:'var(--text-secondary)'}}>Su negocio</p>
                  <h2 className="text-lg font-bold mt-1">{tenant?.name}</h2>
                  <span className="nexus-badge nexus-badge-red mt-2 inline-block">Licencia vencida</span>
                  <p className="text-sm mt-3" style={{color:'var(--text-secondary)'}}>{tenant?.reason}</p>
                  <p className="text-xs mt-2" style={{color:'var(--text-muted)'}}>Contacte a servicio tecnico para renovar su licencia.</p>
                </div>
                <a
                  href={`https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(`Hola, mi negocio "${tenant?.name}" tiene la licencia vencida y quiero renovarla.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nexus-btn w-full justify-center mb-3"
                  style={{background:'#22c55e',color:'white'}}
                >
                  Contactar por WhatsApp
                </a>
                <button onClick={() => setShowPosConfirm(false)} className="nexus-btn nexus-btn-secondary w-full justify-center">
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toasts */}
      {toasts.map(t => (
        <div key={t.id} className={`nexus-toast nexus-toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}