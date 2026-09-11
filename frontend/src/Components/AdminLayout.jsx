import { useState } from 'react';
import { NavLink, Outlet, Link } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, Users, ExternalLink, LogOut, Menu, MessageSquare, Flag, Inbox } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Dialog, { ConfirmDialog } from './Dialog';

/** @type {[string, import('lucide-react').LucideIcon, string][]} */
const items = [['/admin', LayoutDashboard, 'Dashboard'], ['/admin/projects', FolderKanban, 'Projects'], ['/admin/users', Users, 'Users'], ['/admin/comments', MessageSquare, 'Comments'], ['/admin/reports', Flag, 'Reports'], ['/admin/feedback', Inbox, 'Feedback']];

function Navigation({ close, requestLogout, email }) {
  return <><nav className="admin-nav" aria-label="Admin navigation">{items.map(([to, Icon, label]) => <NavLink key={to} end={to === '/admin'} to={to} onClick={close}><Icon size={17} />{label}</NavLink>)}</nav><div className="admin-sidebar-bottom"><Link to="/" onClick={close}><ExternalLink size={16} />View website</Link><button onClick={() => { close(); requestLogout(); }}><LogOut size={16} />Log out</button><span>{email}</span></div></>;
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const close = () => setOpen(false);
  const navigation = <Navigation close={close} requestLogout={() => setConfirmLogout(true)} email={user?.email} />;
  return <div className="admin-shell">
    <aside className="admin-sidebar"><Link className="admin-brand" to="/admin"><span className="admin-mark">v.</span><div><strong>VEXTRA</strong><small>ADMIN WORKSPACE</small></div></Link>{navigation}</aside>
    <div className="admin-main"><header className="admin-mobile-header"><button className="admin-menu" onClick={() => setOpen(true)} aria-label="Open admin navigation" aria-expanded={open} aria-haspopup="dialog"><Menu size={20} /></button><span>VEXTRA ADMIN</span><Link to="/" aria-label="View website"><ExternalLink size={17} /></Link></header><main className="admin-content"><Outlet /></main></div>
    <Dialog open={open} onClose={close} title="Admin workspace"><div className="admin-mobile-navigation">{navigation}</div></Dialog>
    <ConfirmDialog open={confirmLogout} onClose={() => setConfirmLogout(false)} onConfirm={() => { setConfirmLogout(false); logout(); }} title="Log out of Vextra?" description="You can sign in again whenever you are ready to return to the workspace." confirmLabel="Log out" />
  </div>;
}
