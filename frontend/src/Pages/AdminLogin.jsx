import { useState } from 'react';
import { Navigate, useLocation, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getApiError } from '../Services/api';

export default function AdminLogin() {
  const { login, logout, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (isAuthenticated && user?.role === 'admin') return <Navigate to="/admin" replace />;
  async function submit(event) {
    event.preventDefault(); setError(''); setSaving(true);
    try {
      const profile = await login({ username: values.email, password: values.password });
      if (profile.role !== 'admin') { logout(); throw new Error('This account does not have administrator access.'); }
      navigate(location.state?.from || '/admin', { replace: true });
    } catch (reason) { setError(reason.response ? getApiError(reason, 'Those administrator credentials were not accepted.') : reason.message || 'Those administrator credentials were not accepted.'); }
    finally { setSaving(false); }
  }
  return <main className="admin-login-page"><div className="admin-login-panel"><Link className="admin-login-brand" to="/"><span className="admin-mark">v.</span> VEXTRA</Link><span className="eyebrow">PRIVATE WORKSPACE</span><h1>Welcome to<br /><em>admin.</em></h1><p>Manage the project catalogue and member accounts from one considered workspace.</p><form onSubmit={submit}><label htmlFor="admin-email">Email address</label><input id="admin-email" type="email" autoComplete="username" value={values.email} onChange={event => setValues({ ...values, email: event.target.value })} required placeholder="admin@example.com" /><label htmlFor="admin-password">Password</label><input id="admin-password" type="password" autoComplete="current-password" value={values.password} onChange={event => setValues({ ...values, password: event.target.value })} required placeholder="Enter your password" />{error && <div className="admin-form-error" role="alert">{error}</div>}<button className="btn btn-primary" disabled={saving} type="submit">{saving ? 'Signing in...' : 'Sign in to admin'} <ArrowRight size={17} /></button></form><div className="admin-login-foot"><LockKeyhole size={14} /> Role-protected by Vextra authentication</div></div><div className="admin-login-art"><span>VEXTRA / ADMINISTRATION</span><strong>Make the<br /><em>possibilities</em><br />clearer.</strong><p>Projects, people, and the perspective behind them.</p></div></main>;
}
