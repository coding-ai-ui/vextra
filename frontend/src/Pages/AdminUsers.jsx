import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import api from '../Services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../Components/Dialog';
import { AdminError, AdminSkeleton, useAdminResource, adminItems, adminErrorMessage } from '../Components/AdminUI';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const { data, setData, loading, error, reload } = useAdminResource('/users/admin/users/');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [actionError, setActionError] = useState('');
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { document.title = 'Manage users | Vextra'; }, []);
  const filtered = adminItems(data).filter(user => (!role || user.role === role) && `${user.full_name} ${user.username} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase()));
  async function remove() {
    setBusy(true); setActionError('');
    try { await api.delete(`/users/admin/users/${target.id}/`); setData(adminItems(data).filter(item => item.id !== target.id)); setTarget(null); toast({ title: 'Account deleted', message: 'The member account and its personal saved data have been removed.' }); }
    catch (reason) { setActionError(adminErrorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <div><div className="admin-page-heading"><div><span className="eyebrow">PEOPLE</span><h1>Users</h1><p>The people behind each possibility. Open an account to see its activity.</p></div><Link className="btn btn-primary" to="/admin/users/new"><Plus size={16} /> Add user</Link></div>
    <div className="admin-toolbar admin-sticky-controls"><div className="admin-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search names, usernames, or email" aria-label="Search users" /></div><label className="admin-filter">Role<select value={role} onChange={event => setRole(event.target.value)}><option value="">All members</option><option value="user">User</option><option value="admin">Admin</option></select></label><span aria-live="polite">{filtered.length} users</span></div>
    <AdminError message={error} onRetry={reload} />{loading ? <AdminSkeleton label="Loading member accounts" /> : !error && <><div className="admin-data-table" role="table" aria-label="Member accounts"><div className="admin-table-head admin-user-head" role="row"><span role="columnheader">User</span><span role="columnheader">Email</span><span role="columnheader">Role</span><span role="columnheader">Date joined</span><span role="columnheader">Actions</span></div>{filtered.map(user => { const protectedUser = user.id === currentUser?.id || user.email.toLowerCase() === 'talyn2007@gmail.com'; return <div className="admin-table-row admin-user-row" role="row" key={user.id}><span role="cell" className="admin-project-name"><i className="admin-list-avatar" aria-hidden="true">{(user.full_name || user.username).slice(0, 1).toUpperCase()}</i><strong><Link to={`/admin/users/${user.id}`}>{user.full_name || user.username}</Link><small>@{user.username}</small><small className="admin-mobile-meta">{user.email} · {user.role}</small></strong></span><span role="cell">{user.email}</span><span role="cell"><em className={`admin-status ${user.role === 'admin' ? 'is-admin' : ''}`}>{user.role}</em></span><span role="cell">{new Date(user.date_joined).toLocaleDateString()}</span><span role="cell" className="admin-actions"><Link to={`/admin/users/${user.id}`} aria-label={`View ${user.full_name}`}><ArrowUpRight size={16} /></Link><Link to={`/admin/users/${user.id}/edit`} aria-label={`Edit ${user.full_name}`}><Edit3 size={16} /></Link>{!protectedUser && <button onClick={() => { setActionError(''); setTarget(user); }} aria-label={`Delete ${user.full_name}`}><Trash2 size={16} /></button>}</span></div>; })}</div>{!filtered.length && <div className="admin-empty"><h2>No matching members.</h2><p>Try another name, email, or role.</p><button className="btn btn-secondary btn-small" onClick={() => { setSearch(''); setRole(''); }}>Clear filters</button></div>}</>}
    <ConfirmDialog open={Boolean(target)} onClose={() => !busy && setTarget(null)} onConfirm={remove} busy={busy} title="Delete this account?" description={`“${target?.full_name || ''}” will lose access. Their saved projects, simulations, and personal activity will be permanently removed.`} confirmLabel="Delete account"><AdminError message={actionError} /></ConfirmDialog>
  </div>;
}
