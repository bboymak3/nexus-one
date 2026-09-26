'use client';
import { useState, useEffect, useCallback } from 'react';

interface Tenant {
  id: string; name: string; slug: string; description: string;
  owner_name: string; owner_email: string; owner_phone: string;
  plan: string; status: string; max_users: number; max_products: number;
  d1_database_id: string; d1_database_name: string; pos_url: string;
  user_count: number; created_at: string; updated_at: string;
}

interface Toast { id: string; msg: string; type: string; }

export default function AdminDashboard() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<any>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Tenant | null>(null);
  const [detailUsers, setDetailUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [form, setForm] = useState({ name: '', slug: '', description: '', ownerName: '', ownerEmail: '', ownerPhone: '', ownerPassword: '', plan: 'basic', maxUsers: '5', maxProducts: '500' });
  const [userForm, setUserForm] = useState({ tenantId: '', username: '', password: '', fullName: '', role: 'admin' });

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

  // Auth check
  useEffect(() => {
    const t = localStorage.getItem('nexus_token') || document.cookie.match(/session_token=([^;]*)/)?.[1] || '';
    if (!t) { window.location.href = '/?mode=admin'; return; }
    setToken(t);
  }, []);

  // Load data
  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const authData = await api('/api/auth');
        if (authData.userType !== 'super_admin') { window.location.href = '/?mode=admin'; return; }
        setUser(authData.user);
        await loadTenants();
      } catch { window.location.href = '/?mode=admin'; }
    })();
  }, [token]);

  const loadTenants = useCallback(async (searchTerm?: string) => {
    setLoading(true);
    try {
      const params = searchTerm ? `?search=${encodeURIComponent(searchTerm)}` : '';
      const data = await api(`/api/tenants${params}`);
      setTenants(data.tenants || []);
      setStats(data.stats);
    } catch (e: any) { addToast(e.message, 'error'); }
    finally { setLoading(false); }
  }, [api, addToast]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); loadTenants(search); };

  const handleCreateTenant = async () => {
    try {
      const data = await api('/api/tenants', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name, slug: form.slug || undefined,
          description: form.description, ownerName: form.ownerName,
          ownerEmail: form.ownerEmail, ownerPhone: form.ownerPhone,
          ownerPassword: form.ownerPassword || undefined,
          plan: form.plan, maxUsers: parseInt(form.maxUsers), maxProducts: parseInt(form.maxProducts),
        }),
      });
      addToast(`Negocio "${form.name}" creado exitosamente`, 'success');
      setShowModal(false);
      setForm({ name: '', slug: '', description: '', ownerName: '', ownerEmail: '', ownerPhone: '', ownerPassword: '', plan: 'basic', maxUsers: '5', maxProducts: '500' });
      loadTenants();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleToggleStatus = async (tenant: Tenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    try {
      await api('/api/tenants', { method: 'PUT', body: JSON.stringify({ id: tenant.id, status: newStatus }) });
      addToast(`Negocio ${newStatus === 'active' ? 'activado' : 'suspendido'}`, 'success');
      loadTenants();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleDeleteTenant = async (tenant: Tenant) => {
    if (!confirm(`Eliminar "${tenant.name}"? Esta accion es irreversible.`)) return;
    try {
      await api('/api/tenants', { method: 'DELETE', body: JSON.stringify({ id: tenant.id }) });
      addToast(`Negocio eliminado`, 'success');
      loadTenants();
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleViewDetail = async (tenant: Tenant) => {
    setShowDetailModal(tenant);
    try {
      const data = await api(`/api/tenants/${tenant.id}`);
      setDetailUsers(data.users || []);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleCreateUser = async () => {
    try {
      await api('/api/tenants/users', {
        method: 'POST',
        body: JSON.stringify(userForm),
      });
      addToast('Usuario creado', 'success');
      setShowUserModal(false);
      setUserForm({ tenantId: '', username: '', password: '', fullName: '', role: 'admin' });
      if (showDetailModal) handleViewDetail(showDetailModal);
    } catch (e: any) { addToast(e.message, 'error'); }
  };

  const handleCopyUrl = (slug: string) => {
    const url = `${window.location.origin}/${slug}`;
    navigator.clipboard.writeText(url);
    addToast('URL copiada al portapapeles', 'info');
  };

  const handleLogout = () => {
    document.cookie = 'session_token=; path=/; max-age=0';
    localStorage.clear();
    window.location.href = '/?mode=admin';
  };

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{background:'linear-gradient(135deg, #8b5cf6, #06b6d4)'}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              </svg>
            </div>
            <span className="font-bold gradient-text">NEXUS ONE</span>
            <span className="nexus-badge nexus-badge-purple ml-2">Super Admin</span>
          </div>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm hidden sm:inline" style={{color:'var(--text-secondary)'}}>{user.fullName}</span>}
            <button onClick={handleLogout} className="nexus-btn nexus-btn-secondary nexus-btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 animate-fade">
          {[
            { label: 'Total Negocios', value: stats?.total || 0, color: '#8b5cf6', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
            { label: 'Activos', value: stats?.active || 0, color: '#10b981', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'Suspendidos', value: stats?.suspended || 0, color: '#f59e0b', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
            { label: 'Usuarios Total', value: tenants.reduce((a, t) => a + (t.user_count || 0), 0), color: '#3b82f6', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z' },
          ].map((s, i) => (
            <div key={i} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium" style={{color:'var(--text-secondary)'}}>{s.label}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon}/></svg>
              </div>
              <p className="text-2xl font-bold" style={{color:s.color}}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <form onSubmit={handleSearch} className="flex-1 flex gap-2">
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar negocios..."
              className="nexus-input flex-1"
            />
            <button type="submit" className="nexus-btn nexus-btn-secondary">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </button>
          </form>
          <button onClick={() => setShowModal(true)} className="nexus-btn nexus-btn-primary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14m-7-7h14"/></svg>
            Nuevo Negocio
          </button>
        </div>

        {/* Tenants Table */}
        <div className="glass rounded-xl overflow-hidden animate-fade">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin w-8 h-8 border-2 border-t-transparent rounded-full" style={{borderColor:'var(--accent)',borderTopColor:'transparent'}} />
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-20">
              <svg className="mx-auto mb-3" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
              <p style={{color:'var(--text-muted)'}}>No hay negocios creados aun</p>
              <button onClick={() => setShowModal(true)} className="nexus-btn nexus-btn-primary nexus-btn-sm mt-3">Crear primer negocio</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="nexus-table">
                <thead>
                  <tr>
                    <th>Negocio</th>
                    <th className="hidden md:table-cell">Slug / URL</th>
                    <th className="hidden sm:table-cell">Plan</th>
                    <th>Estado</th>
                    <th className="hidden lg:table-cell">Usuarios</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t, i) => (
                    <tr key={t.id} className="animate-slide" style={{animationDelay:`${i * 30}ms`}}>
                      <td>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs" style={{color:'var(--text-muted)'}}>{t.owner_name || 'Sin dueño'}</div>
                      </td>
                      <td className="hidden md:table-cell">
                        <button onClick={() => handleCopyUrl(t.slug)} className="flex items-center gap-1.5 text-xs hover:text-white transition-colors" style={{color:'var(--accent)'}}>
                          /{t.slug}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                        </button>
                      </td>
                      <td className="hidden sm:table-cell">
                        <span className={`nexus-badge ${t.plan === 'premium' ? 'nexus-badge-purple' : t.plan === 'business' ? 'nexus-badge-blue' : 'nexus-badge-green'}`}>{t.plan}</span>
                      </td>
                      <td>
                        <span className={`nexus-badge ${t.status === 'active' ? 'nexus-badge-green' : 'nexus-badge-red'}`}>{t.status}</span>
                      </td>
                      <td className="hidden lg:table-cell">{t.user_count || 0}/{t.max_users}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleViewDetail(t)} className="nexus-btn nexus-btn-secondary nexus-btn-sm" title="Ver detalle">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          </button>
                          <button onClick={() => { setUserForm(prev => ({...prev, tenantId: t.id})); setShowUserModal(true); }} className="nexus-btn nexus-btn-secondary nexus-btn-sm" title="Agregar usuario">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
                          </button>
                          <button onClick={() => handleToggleStatus(t)} className={`nexus-btn nexus-btn-sm ${t.status === 'active' ? 'nexus-btn-danger' : 'nexus-btn-success'}`} title={t.status === 'active' ? 'Suspender' : 'Activar'}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{t.status === 'active'
                              ? <><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></>
                              : <><polygon points="5 3 19 12 5 21 5 3"/></>
                            }</svg>
                          </button>
                          <button onClick={() => handleDeleteTenant(t)} className="nexus-btn nexus-btn-danger nexus-btn-sm" title="Eliminar">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Tenant Modal */}
      {showModal && (
        <div className="nexus-overlay" onClick={() => setShowModal(false)}>
          <div className="nexus-modal p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">Nuevo Negocio</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Nombre del Negocio *</label>
                  <input className="nexus-input" placeholder="Mi Ferreteria" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>URL (slug)</label>
                  <input className="nexus-input" placeholder="mi-ferreteria" value={form.slug} onChange={e => setForm(p => ({...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,'')}))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Descripcion</label>
                <input className="nexus-input" placeholder="Descripcion del negocio" value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Nombre del Dueno</label>
                  <input className="nexus-input" placeholder="Juan Perez" value={form.ownerName} onChange={e => setForm(p => ({...p, ownerName: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Email del Dueno</label>
                  <input className="nexus-input" placeholder="juan@email.com" value={form.ownerEmail} onChange={e => setForm(p => ({...p, ownerEmail: e.target.value}))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Telefono</label>
                  <input className="nexus-input" placeholder="+58 412 1234567" value={form.ownerPhone} onChange={e => setForm(p => ({...p, ownerPhone: e.target.value}))} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Plan</label>
                  <select className="nexus-input" value={form.plan} onChange={e => setForm(p => ({...p, plan: e.target.value}))}>
                    <option value="basic">Basico</option>
                    <option value="business">Business</option>
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </div>
              <div className="p-3 rounded-lg" style={{background:'var(--surface-2)',border:'1px solid var(--border)'}}>
                <p className="text-xs font-medium mb-2" style={{color:'var(--text-secondary)'}}>Credenciales del Administrador del Negocio</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{color:'var(--text-muted)'}}>Clave (min 4 caracteres)</label>
                    <input type="password" className="nexus-input" placeholder="Clave del admin" value={form.ownerPassword} onChange={e => setForm(p => ({...p, ownerPassword: e.target.value}))} />
                  </div>
                  <div className="flex items-end text-xs" style={{color:'var(--text-muted)'}}>
                    <p>Usuario: <strong style={{color:'var(--accent)'}}>{form.slug || 'slug'}-admin</strong></p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowModal(false)} className="nexus-btn nexus-btn-secondary">Cancelar</button>
              <button onClick={handleCreateTenant} disabled={!form.name || form.name.length < 2} className="nexus-btn nexus-btn-primary">Crear Negocio</button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <div className="nexus-overlay" onClick={() => setShowUserModal(false)}>
          <div className="nexus-modal p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-5">Nuevo Usuario</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Nombre Completo</label>
                <input className="nexus-input" placeholder="Nombre del usuario" value={userForm.fullName} onChange={e => setUserForm(p => ({...p, fullName: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Usuario *</label>
                <input className="nexus-input" placeholder="usuario" value={userForm.username} onChange={e => setUserForm(p => ({...p, username: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Clave *</label>
                <input type="password" className="nexus-input" placeholder="********" value={userForm.password} onChange={e => setUserForm(p => ({...p, password: e.target.value}))} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{color:'var(--text-secondary)'}}>Rol</label>
                <select className="nexus-input" value={userForm.role} onChange={e => setUserForm(p => ({...p, role: e.target.value}))}>
                  <option value="admin">Administrador</option>
                  <option value="cajero">Cajero</option>
                  <option value="vendedor">Vendedor</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowUserModal(false)} className="nexus-btn nexus-btn-secondary">Cancelar</button>
              <button onClick={handleCreateUser} disabled={!userForm.username || !userForm.password} className="nexus-btn nexus-btn-primary">Crear Usuario</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="nexus-overlay" onClick={() => setShowDetailModal(null)}>
          <div className="nexus-modal p-6" style={{maxWidth:'640px'}} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{showDetailModal.name}</h3>
              <button onClick={() => setShowDetailModal(null)} className="text-xl" style={{color:'var(--text-muted)'}}>&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm mb-5">
              <div><span style={{color:'var(--text-muted)'}}>Slug:</span> <strong>/{showDetailModal.slug}</strong></div>
              <div><span style={{color:'var(--text-muted)'}}>Plan:</span> <span className={`nexus-badge ${showDetailModal.plan === 'premium' ? 'nexus-badge-purple' : 'nexus-badge-green'}`}>{showDetailModal.plan}</span></div>
              <div><span style={{color:'var(--text-muted)'}}>Estado:</span> <span className={`nexus-badge ${showDetailModal.status === 'active' ? 'nexus-badge-green' : 'nexus-badge-red'}`}>{showDetailModal.status}</span></div>
              <div><span style={{color:'var(--text-muted)'}}>Dueno:</span> {showDetailModal.owner_name || 'N/A'}</div>
              <div><span style={{color:'var(--text-muted)'}}>Email:</span> {showDetailModal.owner_email || 'N/A'}</div>
              <div><span style={{color:'var(--text-muted)'}}>Telefono:</span> {showDetailModal.owner_phone || 'N/A'}</div>
              <div className="col-span-2"><span style={{color:'var(--text-muted)'}}>POS:</span> {showDetailModal.pos_url || 'Compartido (MYECOMMERCE_URL)'}</div>
              <div><span style={{color:'var(--text-muted)'}}>Creado:</span> {new Date(showDetailModal.created_at).toLocaleDateString('es')}</div>
              <div><span style={{color:'var(--text-muted)'}}>Max Usuarios:</span> {showDetailModal.max_users}</div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold">Usuarios del Negocio</h4>
                <button onClick={() => { setUserForm(prev => ({...prev, tenantId: showDetailModal!.id})); setShowDetailModal(null); setShowUserModal(true); }} className="nexus-btn nexus-btn-primary nexus-btn-sm">+ Usuario</button>
              </div>
              {detailUsers.length === 0 ? (
                <p className="text-sm" style={{color:'var(--text-muted)'}}>No hay usuarios en este negocio</p>
              ) : (
                <div className="rounded-lg overflow-hidden" style={{border:'1px solid var(--border)'}}>
                  <table className="nexus-table">
                    <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Ultimo Login</th></tr></thead>
                    <tbody>
                      {detailUsers.map(u => (
                        <tr key={u.id}>
                          <td className="font-mono text-xs">{u.username}</td>
                          <td>{u.full_name}</td>
                          <td><span className="nexus-badge nexus-badge-blue">{u.role}</span></td>
                          <td className="text-xs" style={{color:'var(--text-muted)'}}>{u.last_login ? new Date(u.last_login).toLocaleString('es') : 'Nunca'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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