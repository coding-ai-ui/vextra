import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import api from '../Services/api';
import { AdminError, AdminSkeleton, useAdminResource, adminErrorMessage, adminItems } from '../Components/AdminUI';
import { ConfirmDialog } from '../Components/Dialog';
import { useToast } from '../context/ToastContext';

export default function AdminProjects() {
  const { data, setData, loading, error, reload } = useAdminResource('/projects/?admin=true');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [actionError, setActionError] = useState('');
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const status = params.get('status') || '';
  useEffect(() => { document.title = 'Manage projects | Vextra'; }, []);
  const filtered = adminItems(data).filter(project => (!status || project.status === status) && `${project.title} ${project.category} ${project.organization || ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  async function remove() {
    setBusy(true); setActionError('');
    try { await api.delete(`/projects/admin/${target.id}/`); setData(adminItems(data).filter(item => item.id !== target.id)); setTarget(null); toast({ title: 'Project deleted', message: 'The project has been removed from the catalogue.' }); }
    catch (reason) { setActionError(adminErrorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <div><div className="admin-page-heading"><div><span className="eyebrow">CATALOGUE</span><h1>Projects</h1><p>Create a draft, preview the story, then publish when it is ready.</p></div><Link className="btn btn-primary" to="/admin/projects/new"><Plus size={16} /> Add project</Link></div>
    <div className="admin-toolbar admin-sticky-controls"><div className="admin-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search projects or organizations" aria-label="Search projects" /></div><label className="admin-filter">Status<select value={status} onChange={event => { const next = new URLSearchParams(params); if (event.target.value) next.set('status', event.target.value); else next.delete('status'); setParams(next); }}><option value="">All projects</option><option value="draft">Draft</option><option value="active">Active</option><option value="completed">Completed</option></select></label><span aria-live="polite">{filtered.length} projects</span></div>
    <AdminError message={error} onRetry={reload} />{loading ? <AdminSkeleton label="Loading projects" /> : !error && <><div className="admin-data-table" role="table" aria-label="Manage projects"><div className="admin-table-head" role="row"><span role="columnheader">Project</span><span role="columnheader">Category</span><span role="columnheader">Return</span><span role="columnheader">Status</span><span role="columnheader">Actions</span></div>{filtered.map(project => <div className="admin-table-row" role="row" key={project.id}><span role="cell" className="admin-project-name"><i aria-hidden="true">{project.title.slice(0, 1)}</i><strong><Link to={`/admin/projects/${project.id}/edit`}>{project.title}</Link><small>{project.short_description}</small><small className="admin-mobile-meta">{project.category} · {project.status} · {project.expected_return}% scenario</small></strong></span><span role="cell">{project.category}</span><span role="cell" className="admin-return">{project.expected_return}%</span><span role="cell"><em className={`admin-status status-${project.status}`}>{project.status || 'Active'}</em>{project.featured && <small className="admin-featured">Featured</small>}</span><span role="cell" className="admin-actions">{project.status !== 'draft' && <Link to={`/projects/${project.slug || project.id}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${project.title}`}><ArrowUpRight size={16} /></Link>}<Link to={`/admin/projects/${project.id}/edit`} aria-label={`Edit ${project.title}`}><Edit3 size={16} /></Link><button onClick={() => { setActionError(''); setTarget(project); }} aria-label={`Delete ${project.title}`}><Trash2 size={16} /></button></span></div>)}</div>{!filtered.length && <div className="admin-empty"><h2>{search || status ? 'No matching projects' : 'Start with one possibility.'}</h2><p>{search || status ? 'Try a broader search or clear your filters.' : 'Create a draft and shape its story before publishing.'}</p>{search || status ? <button className="btn btn-secondary btn-small" onClick={() => { setSearch(''); setParams({}); }}>Clear filters</button> : <Link className="btn btn-primary btn-small" to="/admin/projects/new">Create project</Link>}</div>}</>}
    <ConfirmDialog open={Boolean(target)} onClose={() => !busy && setTarget(null)} onConfirm={remove} busy={busy} title="Delete this project?" description={`“${target?.title || ''}” and its related bookmarks and discussions will be removed. Projects with saved simulations cannot be deleted; mark them completed to preserve portfolio history. This cannot be undone.`} confirmLabel="Delete project"><AdminError message={actionError} /></ConfirmDialog>
  </div>;
}
