import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, FolderKanban, Users, Plus, MessageSquare, Flag, Inbox, FileEdit, ChartNoAxesCombined } from 'lucide-react';
import { AdminError, AdminSkeleton, useAdminResource } from '../Components/AdminUI';
import { CountUp, Reveal } from '../Components/ui';

/** @type {[string, string, import('lucide-react').LucideIcon, string][]} */
const metrics = [['projects', 'Projects', FolderKanban, '/admin/projects'], ['users', 'Member accounts', Users, '/admin/users'], ['comments', 'Comments', MessageSquare, '/admin/comments'], ['reports', 'Open reports', Flag, '/admin/reports'], ['feedback', 'Open messages', Inbox, '/admin/feedback'], ['draft_projects', 'Project drafts', FileEdit, '/admin/projects?status=draft']];
export default function AdminDashboard() {
  const { data, loading, error, reload } = useAdminResource('/users/admin/stats/');
  useEffect(() => { document.title = 'Admin dashboard | Vextra'; }, []);
  return <div><div className="admin-page-heading"><div><span className="eyebrow">OVERVIEW</span><h1>Vextra Admin</h1><p>The projects, people, and conversations shaping this community.</p></div><Link className="btn btn-primary" to="/admin/projects/new"><Plus size={16} /> Add project</Link></div>
    <AdminError message={error} onRetry={reload} />{loading ? <AdminSkeleton label="Loading platform statistics" /> : data && <>
      <div className="admin-stat-grid admin-overview-grid">{metrics.map(([key, label, Icon, to], index) => <Reveal key={key} delay={index * 35}><article><span><Icon size={18} /></span><small>{label}</small><strong><CountUp value={data[key] ?? 0} /></strong><Link to={to}>View {label.toLowerCase()} <ArrowUpRight size={14} /></Link></article></Reveal>)}</div>
      <div className="admin-simulation-note"><ChartNoAxesCombined size={20} /><div><strong>{Number(data.simulations || 0).toLocaleString()} saved simulations</strong><span>Learning through fictional allocations. No real funds are processed.</span></div></div>
      <div className="admin-two-column"><section className="admin-table-card"><div className="admin-card-heading"><div><span className="eyebrow">RECENT WORK</span><h2>Recent projects</h2></div><Link to="/admin/projects">View all <ArrowUpRight size={14} /></Link></div><div className="admin-list">{(data.recent_projects || []).map(project => <Link key={project.id} to={`/admin/projects/${project.id}/edit`}><span className="admin-list-icon">{project.title.slice(0, 1)}</span><span><strong>{project.title}</strong><small>{project.category}</small></span><b>{project.status || 'Active'}</b></Link>)}{!data.recent_projects?.length && <p className="admin-inline-empty">Create a draft to start your catalogue.</p>}</div></section>
      <section className="admin-table-card"><div className="admin-card-heading"><div><span className="eyebrow">COMMUNITY</span><h2>Recent users</h2></div><Link to="/admin/users">View all <ArrowUpRight size={14} /></Link></div><div className="admin-list">{(data.recent_users || []).map(user => <Link key={user.id} to={`/admin/users/${user.id}`}><span className="admin-list-avatar">{(user.full_name || user.username || user.email).slice(0, 1).toUpperCase()}</span><span><strong>{user.full_name || user.username}</strong><small>{user.email}</small></span><b className={user.role === 'admin' ? 'is-admin' : ''}>{user.role}</b></Link>)}{!data.recent_users?.length && <p className="admin-inline-empty">New member accounts will appear here.</p>}</div></section></div>
    </>}
  </div>;
}
