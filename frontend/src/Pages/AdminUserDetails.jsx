import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit3, Trash2, Bookmark, Bell, MessageSquare, ChartNoAxesCombined, ShieldCheck } from 'lucide-react';
import api from '../Services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../Components/Dialog';
import { AdminError, AdminSkeleton, useAdminResource, adminErrorMessage, adminDate } from '../Components/AdminUI';

/** @type {[string, string, import('lucide-react').LucideIcon][]} */
const metrics = [['saved', 'Saved projects', Bookmark], ['following', 'Followed projects', Bell], ['comments', 'Comments', MessageSquare], ['simulations', 'Simulations', ChartNoAxesCombined]];
export default function AdminUserDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { data: user, loading, error, reload } = useAdminResource(`/users/admin/users/${id}/`);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const protectedUser = user && (user.id === currentUser?.id || user.email.toLowerCase() === 'talyn2007@gmail.com');
  useEffect(() => { document.title = 'Member account | Vextra'; }, []);
  async function remove() {
    setBusy(true); setActionError('');
    try { await api.delete(`/users/admin/users/${id}/`); toast({ title: 'Account deleted', message: 'The account and its personal saved data have been removed.' }); navigate('/admin/users'); }
    catch (reason) { setActionError(adminErrorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <div><Link className="admin-back" to="/admin/users"><ArrowLeft size={15} /> Back to users</Link><AdminError message={error} onRetry={reload} />{loading ? <AdminSkeleton label="Loading member account" /> : user && !error && <>
    <div className="admin-member-heading"><span className="admin-member-avatar" aria-hidden="true">{(user.full_name || user.username).slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">MEMBER ACCOUNT</span><h1>{user.full_name || user.username}</h1><p>@{user.username} <span className={`admin-status ${user.role === 'admin' ? 'is-admin' : ''}`}>{user.role}</span></p></div><Link className="btn btn-secondary" to={`/admin/users/${id}/edit`}><Edit3 size={16} />Edit account</Link></div>
    <div className="admin-member-metrics">{metrics.map(([key, label, Icon]) => <article key={key}><Icon size={18} /><strong>{Number(user.counts?.[key] || 0).toLocaleString()}</strong><span>{label}</span>{key === 'comments' && <Link to={`/admin/comments?user=${id}`}>Review comments →</Link>}</article>)}</div>
    <section className="admin-table-card admin-account-information"><div className="admin-card-heading"><h2>Account information</h2><ShieldCheck size={20} /></div><dl><div><dt>Email address</dt><dd>{user.email}</dd></div><div><dt>Joined</dt><dd>{adminDate(user.date_joined)}</dd></div><div><dt>Role</dt><dd>{user.role === 'admin' ? 'Administrator' : 'Member'}</dd></div><div><dt>Access</dt><dd>{user.is_active ? 'Active account' : 'Sign-in disabled'}</dd></div>{user.bio && <div><dt>Bio</dt><dd>{user.bio}</dd></div>}</dl></section>
    {protectedUser ? <p className="admin-protected-note"><ShieldCheck size={16} />This administrator account is protected from deletion.</p> : <section className="admin-account-danger"><div><h2>Delete account</h2><p>Permanently remove this member and their personal saved data.</p></div><button className="btn btn-secondary admin-danger-text" onClick={() => { setActionError(''); setConfirm(true); }}><Trash2 size={16} />Delete account</button></section>}
  </>}
  <ConfirmDialog open={confirm} onClose={() => !busy && setConfirm(false)} onConfirm={remove} busy={busy} title="Delete this account?" description={`This permanently removes ${user?.full_name || 'this member'}’s account, saved projects, portfolio simulations, and personal activity. This cannot be undone.`} confirmLabel="Delete account"><AdminError message={actionError} /></ConfirmDialog>
  </div>;
}
