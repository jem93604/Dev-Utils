// Auth pages in the app's design language (theme vars, .fg/.tbtn, Syne/Mono).
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  listUsers, updateUser, type AuthUser,
} from '../lib/api';
import { Empty, Field, SectionHeader, TButton, toast } from '../components/ui';
import type { AuthState } from '../hooks/useAuth';

export function LoginPage({ auth }: { auth: AuthState }) {
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!auth.loading && auth.user) nav('/', { replace: true });
  }, [auth.loading, auth.user, nav]);

  if (auth.loading) {
    return <div className="empty"><div className="empty-text">Loading…</div></div>;
  }

  if (auth.status && !auth.status.auth_enabled) {
    return (
      <div className="sections-wrapper visible">
        <Empty
          icon="🔓" text="Login is disabled"
          hint="This server runs in single-user mode (AUTH_ENABLED=false)"
          action={<NavLink to="/" className="tbtn tbtn-primary" style={{ textDecoration: 'none' }}>Continue →</NavLink>}
        />
      </div>
    );
  }

  const submit = async () => {
    if (!email.trim() || !password) { setError('Email and password are required'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setBusy(true);
    setError('');
    const err = mode === 'login'
      ? await auth.login(email.trim(), password)
      : await auth.register(email.trim(), password, name.trim());
    setBusy(false);
    if (err) setError(err);
    else nav('/', { replace: true });
  };

  return (
    <div className="sections-wrapper visible" style={{ maxWidth: 440, margin: '40px auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: '2rem' }}>⚡</div>
        <div style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--amber)' }}>SQL HUB</div>
        <div style={{ fontSize: '.75rem', color: 'var(--text3)', fontFamily: "'JetBrains Mono',monospace" }}>
          {mode === 'login' ? 'sign in to your workspace' : 'create your account'}
        </div>
      </div>
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 13, padding: 20 }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m} className="fmt-btn" onClick={() => { setMode(m); setError(''); }}
              style={mode === m ? { borderColor: 'var(--amber)', color: 'var(--amber)' } : undefined}
            >
              {m === 'login' ? 'Sign in' : 'Register'}
            </button>
          ))}
        </div>
        {mode === 'register' && (
          <Field label="Display name (optional)">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Priya" maxLength={120} />
          </Field>
        )}
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@team.com"
            autoComplete="email" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </Field>
        <Field label="Password (min 8 characters)">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
        </Field>
        {error && <div style={{ color: 'var(--red)', fontSize: '.78rem', marginBottom: 10 }}>{error}</div>}
        <TButton variant="primary" onClick={submit}>
          {busy ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </TButton>
        {mode === 'register' && (
          <div style={{ marginTop: 10, fontSize: '.7rem', color: 'var(--text3)', lineHeight: 1.5 }}>
            The first account on a server automatically becomes admin and keeps any existing content.
            Each account gets a private workspace.
          </div>
        )}
      </div>
    </div>
  );
}

export function UsersPage({ auth }: { auth: AuthState }) {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    listUsers().then(setUsers).catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <div className="sections-wrapper visible">
        <Empty icon="🔒" text="Admins only" hint="Your account cannot manage users" />
      </div>
    );
  }

  const toggleActive = async (u: AuthUser) => {
    if (u.id === auth.user?.id && u.is_active) {
      toast('You cannot deactivate yourself');
      return;
    }
    if (u.is_active && !window.confirm(`Deactivate ${u.email}? They will be signed out immediately.`)) return;
    try {
      const updated = await updateUser(u.id, { is_active: !u.is_active });
      setUsers((us) => us.map((x) => (x.id === updated.id ? updated : x)));
      toast(updated.is_active ? 'Account reactivated ✓' : 'Account deactivated');
    } catch {
      toast('Update failed');
    }
  };

  return (
    <div className="sections-wrapper visible">
      <section className="section-block">
        <SectionHeader color="var(--amber)" title="👥 Users" badge={`${users.length}`} />
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 9, padding: 16 }}>
          <table className="lib-table">
            <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.email}</td>
                  <td style={{ color: 'var(--text2)' }}>{u.display_name}</td>
                  <td>{u.is_admin ? '👑 admin' : 'member'}</td>
                  <td style={{ color: u.is_active ? 'var(--green)' : 'var(--red)' }}>
                    {u.is_active ? 'active' : 'deactivated'}
                  </td>
                  <td style={{ color: 'var(--text3)', fontSize: '.72rem' }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className="qbtn" onClick={() => toggleActive(u)}>
                      {u.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
