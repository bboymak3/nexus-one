'use client';
import { useState, useEffect } from 'react';

export default function LoginPage() {
  const [mode, setMode] = useState<'landing' | 'admin' | 'tenant'>('landing');
  const [tenantSlug, setTenantSlug] = useState('');
  // Si el slug ya viene en la URL (p. ej. /mi-negocio), no hace falta pedirlo: solo usuario y clave.
  const [slugFromUrl, setSlugFromUrl] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toasts, setToasts] = useState<{id:string;msg:string;type:string}[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'admin') setMode('admin');
    if (params.get('error') === 'expired') setError('Sesion expirada. Inicia sesion de nuevo.');
    if (params.get('error') === 'forbidden') setError('Acceso denegado.');
    // Check if we're on a tenant path
    const path = window.location.pathname;
    const match = path.match(/^\/([a-z0-9-]+)$/);
    if (match && match[1] !== 'admin' && match[1] !== 'api') {
      setTenantSlug(match[1]);
      setSlugFromUrl(true);
      setMode('tenant');
    }
  }, []);

  const addToast = (msg: string, type: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const body: any = { username, password };
      if (mode === 'tenant') {
        if (!tenantSlug) { setError('Slug del negocio es requerido'); setLoading(false); return; }
        body.action = 'tenant_login';
        body.tenantSlug = tenantSlug;
      } else {
        body.action = 'admin_login';
      }

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesion');
        setLoading(false);
        return;
      }

      // Store token
      document.cookie = `session_token=${data.token}; path=/; max-age=86400; SameSite=Lax`;
      localStorage.setItem('nexus_token', data.token);
      localStorage.setItem('nexus_user', JSON.stringify(data.user));
      localStorage.setItem('nexus_userType', data.userType);
      if (data.tenant) localStorage.setItem('nexus_tenant', JSON.stringify(data.tenant));

      addToast('Sesion iniciada correctamente', 'success');

      // Redirect
      if (data.userType === 'super_admin') {
        window.location.href = '/admin';
      } else if (data.tenant?.slug) {
        window.location.href = `/${data.tenant.slug}/dashboard`;
      }
    } catch (err: any) {
      setError('Error de conexion. Verifica tu red.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full" style={{background:'radial-gradient(circle, rgba(139,92,246,0.08), transparent 70%)'}} />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full" style={{background:'radial-gradient(circle, rgba(6,182,212,0.06), transparent 70%)'}} />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 animate-glow" style={{background:'linear-gradient(135deg, #8b5cf6, #06b6d4)'}}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
              <line x1="12" y1="22" x2="12" y2="15.5" />
              <polyline points="22 8.5 12 15.5 2 8.5" />
              <polyline points="2 15.5 12 8.5 22 15.5" />
              <line x1="12" y1="2" x2="12" y2="8.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold gradient-text">NEXUS ONE</h1>
          <p className="text-sm mt-1" style={{color:'var(--text-secondary)'}}>Plataforma Multi-Tenant</p>
        </div>

        {/* Login Card */}
        <div className="glass rounded-2xl p-6">
          {/* Mode Tabs (only on landing) */}
          {mode === 'landing' && (
            <div className="flex rounded-xl p-1 mb-6" style={{background:'var(--surface-2)'}}>
              <button
                onClick={() => { setMode('admin'); setError(''); }}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all hover:text-white"
                style={{color:'var(--text-secondary)'}}
              >
                Super Admin
              </button>
              <button
                onClick={() => { setMode('tenant'); setError(''); }}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-all hover:text-white"
                style={{color:'var(--text-secondary)'}}
              >
                Mi Negocio
              </button>
            </div>
          )}

          {/* Back button */}
          {mode !== 'landing' && !slugFromUrl && (
            <button
              onClick={() => { setMode('landing'); setError(''); setTenantSlug(''); setSlugFromUrl(false); }}
              className="flex items-center gap-2 text-sm mb-4 hover:text-white transition-colors"
              style={{color:'var(--text-muted)'}}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Volver
            </button>
          )}

          <h2 className="text-lg font-semibold mb-5">
            {mode === 'admin' ? 'Iniciar Sesion - Admin' : 'Iniciar Sesion - Negocio'}
          </h2>

          {/* Tenant Slug (solo si no vino ya en la URL, p. ej. entrando desde el landing) */}
          {mode === 'tenant' && !slugFromUrl && (
            <div className="mb-4">
              <label className="block text-xs font-medium mb-1.5" style={{color:'var(--text-secondary)'}}>
                URL del Negocio
              </label>
              <div className="flex rounded-lg overflow-hidden" style={{border:'1px solid var(--border)'}}>
                <span className="flex items-center px-3 text-xs" style={{background:'var(--surface-2)',color:'var(--text-muted)'}}>/</span>
                <input
                  type="text"
                  value={tenantSlug}
                  onChange={e => setTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="mi-negocio"
                  className="nexus-input border-0 rounded-none"
                  onKeyDown={handleKeyDown}
                />
              </div>
            </div>
          )}

          {/* Username */}
          <div className="mb-4">
            <label className="block text-xs font-medium mb-1.5" style={{color:'var(--text-secondary)'}}>Usuario</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder={mode === 'tenant' ? 'usuario' : 'superadmin'}
              className="nexus-input"
              onKeyDown={handleKeyDown}
              autoFocus
            />
          </div>

          {/* Password */}
          <div className="mb-5">
            <label className="block text-xs font-medium mb-1.5" style={{color:'var(--text-secondary)'}}>Clave</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="********"
              className="nexus-input"
              onKeyDown={handleKeyDown}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm" style={{background:'rgba(239,68,68,0.1)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.2)'}}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={loading || !username || !password}
            className="nexus-btn nexus-btn-primary w-full justify-center py-3 text-base"
          >
            {loading ? (
              <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : 'Iniciar Sesion'}
          </button>

          {/* Hints */}
          {mode === 'admin' && (
            <p className="text-center text-xs mt-4" style={{color:'var(--text-muted)'}}>
              Credenciales por defecto: <strong>superadmin</strong> / <strong>admin123</strong>
            </p>
          )}
          {mode === 'tenant' && (
            <p className="text-center text-xs mt-4" style={{color:'var(--text-muted)'}}>
              {slugFromUrl ? 'Ingresa tu usuario y clave' : 'Ingresa la URL de tu negocio y tus credenciales'}
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{color:'var(--text-muted)'}}>
          Nexus One v1.0 &mdash; Multi-Tenant Platform
        </p>
      </div>

      {/* Toasts */}
      {toasts.map(t => (
        <div key={t.id} className={`nexus-toast nexus-toast-${t.type}`}>{t.msg}</div>
      ))}
    </div>
  );
}