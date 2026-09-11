import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Search, MessageSquare, Eye, EyeOff, Trash2, Flag, Check, ExternalLink } from 'lucide-react';
import api from '../Services/api';
import { AdminError, AdminSkeleton, useAdminResource, adminItems, adminErrorMessage, adminDate } from '../Components/AdminUI';
import { ConfirmDialog } from '../Components/Dialog';
import { useToast } from '../context/ToastContext';

export default function AdminComments() {
  const location = useLocation();
  const reportsView = location.pathname.endsWith('/reports');
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [debounced, setDebounced] = useState(search);
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');
  const { toast } = useToast();
  const project = params.get('project') || '';
  const author = params.get('user') || '';
  const status = params.get('status') || 'all';
  useEffect(() => { document.title = `${reportsView ? 'Comment reports' : 'Manage comments'} | Vextra`; }, [reportsView]);
  useEffect(() => { const timer = setTimeout(() => setDebounced(search), 220); return () => clearTimeout(timer); }, [search]);
  const query = new URLSearchParams({ search: debounced, project, user: author, status });
  const comments = useAdminResource('/community/admin/comments/?' + query.toString());
  const reports = useAdminResource('/community/admin/reports/');
  const projects = useAdminResource('/projects/?admin=true');
  const users = useAdminResource('/users/admin/users/');
  const commentItems = adminItems(comments.data);
  const filteredReports = adminItems(reports.data).filter(report => {
    const comment = report.comment || {};
    return (!project || String(comment.project) === project) && (!author || String(comment.author?.id) === author) && `${report.reason} ${comment.body} ${comment.project_title} ${comment.author?.username}`.toLowerCase().includes(debounced.toLowerCase()) && (status === 'all' || status === 'reported' ? report.status === 'open' : status === 'dismissed' ? report.status === 'dismissed' : comment.is_hidden);
  });
  const source = reportsView ? reports : comments;
  const items = reportsView ? filteredReports : commentItems;
  const updateFilter = (key, value) => { const next = new URLSearchParams(params); if (value && value !== 'all') next.set(key, value); else next.delete(key); setParams(next, { replace: true }); };
  async function moderate(comment, action) {
    setBusy(`${action}-${comment.id}`); setActionError('');
    try {
      if (action === 'delete') await api.delete(`/community/admin/comments/${comment.id}/`);
      else await api.patch(`/community/admin/comments/${comment.id}/`, { is_hidden: !comment.is_hidden });
      setTarget(null); comments.reload(); reports.reload();
      toast({ title: action === 'delete' ? 'Comment deleted' : comment.is_hidden ? 'Comment restored' : 'Comment hidden', message: action === 'delete' ? 'The comment text has been removed from the discussion.' : comment.is_hidden ? 'This comment is visible in its project discussion again.' : 'This comment is now hidden from the public discussion.' });
    } catch (reason) { setActionError(adminErrorMessage(reason)); }
    finally { setBusy(''); }
  }
  async function dismiss(report) {
    setBusy(`report-${report.id}`); setActionError('');
    try { await api.post(`/community/admin/reports/${report.id}/dismiss/`); reports.reload(); comments.reload(); toast({ title: 'Report dismissed', message: 'The report has been reviewed. The comment is unchanged.' }); }
    catch (reason) { setActionError(adminErrorMessage(reason)); }
    finally { setBusy(''); }
  }
  function commentCard(comment, report) {
    return <article key={report ? `report-${report.id}` : comment.id} className={`admin-comment-card ${comment.is_hidden ? 'is-hidden' : ''}`}>
      <header><span className="admin-list-avatar" aria-hidden="true">{(comment.author?.username || '?').slice(0, 1).toUpperCase()}</span><div><span className="admin-comment-author">{comment.author?.id ? <Link to={`/admin/users/${comment.author.id}`}>{[comment.author.first_name, comment.author.last_name].filter(Boolean).join(' ') || comment.author.username}</Link> : 'Former member'}</span><small><time dateTime={comment.created_at}>{adminDate(comment.created_at)}</time>{comment.parent && ' · Reply'}{comment.is_edited && ' · Edited'}</small></div><span className={`admin-status ${comment.is_hidden ? 'status-draft' : ''}`}>{comment.is_deleted ? 'Deleted' : comment.is_hidden ? 'Hidden' : 'Visible'}</span></header>
      <Link className="admin-comment-project" to={`/projects/${comment.project_slug || comment.project}#discussion`}><ExternalLink size={13} />{comment.project_title}</Link>
      <p className="admin-comment-body">{comment.body || 'This comment has been deleted.'}</p>
      {report && <div className="admin-report-reason"><Flag size={16} /><div><strong>Reported by {report.reporter?.username || 'a member'}</strong><p>{report.reason}</p><small>{adminDate(report.created_at)} · {report.status}</small></div></div>}
      <footer><span>{comment.reaction_count || 0} useful votes{Number(comment.report_count) > 0 && ` · ${comment.report_count} open reports`}</span><div className="admin-moderation-actions">{report && report.status === 'open' && <button className="btn btn-secondary btn-small" disabled={Boolean(busy)} onClick={() => dismiss(report)}><Check size={14} />{busy === `report-${report.id}` ? 'Dismissing…' : 'Dismiss report'}</button>}{!comment.is_deleted && <><button className="btn btn-secondary btn-small" disabled={Boolean(busy)} onClick={() => moderate(comment, 'visibility')}>{comment.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}{busy === `visibility-${comment.id}` ? 'Updating…' : comment.is_hidden ? 'Unhide' : 'Hide'}</button><button className="btn btn-secondary btn-small admin-danger-text" disabled={Boolean(busy)} onClick={() => { setActionError(''); setTarget(comment); }}><Trash2 size={14} />Delete</button></>}</div></footer>
    </article>;
  }
  return <div><div className="admin-page-heading"><div><span className="eyebrow">COMMUNITY CARE</span><h1>{reportsView ? 'Reports' : 'Comments'}</h1><p>Keep discussions thoughtful, useful, and open to different perspectives.</p></div><MessageSquare className="admin-heading-icon" size={32} strokeWidth={1.2} /></div>
    <nav className="admin-tabs" aria-label="Discussion moderation"><Link to="/admin/comments" aria-current={!reportsView ? 'page' : undefined}>All comments</Link><Link to="/admin/reports" aria-current={reportsView ? 'page' : undefined}>Reported comments</Link></nav>
    <div className="admin-toolbar admin-moderation-toolbar admin-sticky-controls"><div className="admin-search"><Search size={17} /><input aria-label="Search comments" placeholder="Search the discussion" value={search} onChange={event => { setSearch(event.target.value); updateFilter('search', event.target.value); }} /></div><label className="admin-filter">Project<select value={project} onChange={event => updateFilter('project', event.target.value)}><option value="">Every project</option>{adminItems(projects.data).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label className="admin-filter">Author<select value={author} onChange={event => updateFilter('user', event.target.value)}><option value="">Every member</option>{adminItems(users.data).map(item => <option key={item.id} value={item.id}>{item.full_name || item.username}</option>)}</select></label><label className="admin-filter">Status<select value={status} onChange={event => updateFilter('status', event.target.value)}><option value="all">{reportsView ? 'Open reports' : 'All statuses'}</option>{!reportsView && <option value="reported">Reported</option>}<option value="hidden">Hidden comments</option>{reportsView && <option value="dismissed">Dismissed reports</option>}</select></label>{(search || project || author || status !== 'all') && <button className="admin-clear-filters" onClick={() => { setSearch(''); setParams({}); }}>Clear filters</button>}</div>
    <AdminError message={source.error} onRetry={source.reload} /><AdminError message={!target ? actionError : ''} />{(projects.error || users.error) && <AdminError message="Some filter options could not load." onRetry={() => { projects.reload(); users.reload(); }} />}
    <p className="admin-result-count" aria-live="polite">{loadingLabel(source.loading, items.length, reportsView)}</p>
    {source.loading ? <AdminSkeleton label={reportsView ? 'Loading reports' : 'Loading comments'} rows={3} /> : !source.error && <div className="admin-comment-list">{items.map(item => reportsView ? commentCard(item.comment, item) : commentCard(item))}{!items.length && <div className="admin-empty"><MessageSquare size={30} strokeWidth={1.2} /><h2>{reportsView ? 'The review queue is clear.' : 'Room for a thoughtful conversation.'}</h2><p>{reportsView ? 'Reports matching your filters will appear here for review.' : 'Comments matching your filters will appear here when members join a discussion.'}</p><Link className="btn btn-secondary btn-small" to="/projects">Explore projects</Link></div>}</div>}
    <ConfirmDialog open={Boolean(target)} onClose={() => !busy && setTarget(null)} onConfirm={() => moderate(target, 'delete')} busy={Boolean(busy)} title="Delete this comment?" description="The comment text will be permanently removed. Replies remain connected so the conversation still makes sense." confirmLabel="Delete comment"><AdminError message={actionError} /></ConfirmDialog>
  </div>;
}
function loadingLabel(loading, length, reports) { return loading ? 'Refreshing the conversation…' : `${length} ${reports ? 'reports' : 'comments'}`; }
