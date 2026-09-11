import { useEffect, useState } from 'react';
import { Inbox, Search, Check, Mail } from 'lucide-react';
import api from '../Services/api';
import Dialog from '../Components/Dialog';
import { AdminError, AdminSkeleton, useAdminResource, adminItems, adminErrorMessage, adminDate } from '../Components/AdminUI';
import { useToast } from '../context/ToastContext';

const kinds = { contact: 'Contact message', feature: 'Feature suggestion', bug: 'Bug report', general: 'General feedback' };
export default function AdminFeedback() {
  const { data, setData, loading, error, reload } = useAdminResource('/community/admin/feedback/');
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('open');
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const { toast } = useToast();
  useEffect(() => { document.title = 'Feedback inbox | Vextra'; }, []);
  const items = adminItems(data).filter(item => (!kind || item.kind === kind) && (!status || (status === 'open' ? item.status !== 'resolved' : item.status === 'resolved')) && `${item.name} ${item.email} ${item.subject} ${item.message}`.toLowerCase().includes(search.trim().toLowerCase()));
  async function resolve() {
    setBusy(true); setActionError('');
    try { const { data: updated } = await api.patch(`/community/admin/feedback/${selected.id}/`, { status: 'resolved' }); setData(adminItems(data).map(item => item.id === selected.id ? { ...item, ...updated, status: 'resolved' } : item)); setSelected(null); toast({ title: 'Message resolved', message: 'This conversation is now in the resolved inbox.' }); }
    catch (reason) { setActionError(adminErrorMessage(reason)); }
    finally { setBusy(false); }
  }
  return <div><div className="admin-page-heading"><div><span className="eyebrow">LISTEN & IMPROVE</span><h1>The inbox.</h1><p>Questions, ideas, and small improvements from the people using Vextra.</p></div><Inbox className="admin-heading-icon" size={32} strokeWidth={1.2} /></div>
    <div className="admin-toolbar admin-sticky-controls"><div className="admin-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} aria-label="Search feedback" placeholder="Search messages or people" /></div><label className="admin-filter">Type<select value={kind} onChange={event => setKind(event.target.value)}><option value="">All messages</option>{Object.entries(kinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="admin-filter">Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="open">Open</option><option value="resolved">Resolved</option><option value="">All statuses</option></select></label></div>
    <AdminError message={error} onRetry={reload} />{loading ? <AdminSkeleton label="Loading inbox" /> : !error && <><p className="admin-result-count" aria-live="polite">{items.length} messages</p><div className="admin-inbox">{items.map(item => <button key={item.id} className="admin-inbox-row" onClick={() => { setActionError(''); setSelected(item); }}><span className="admin-inbox-icon">{item.status === 'resolved' ? <Check size={20} /> : <Mail size={20} />}</span><span><span className="admin-inbox-meta">{kinds[item.kind] || item.kind} · {item.name || item.email}</span><strong>{item.subject || kinds[item.kind]}</strong><span className="admin-inbox-excerpt">{item.message}</span></span><span className="admin-inbox-date">{adminDate(item.created_at)}<em className="admin-status">{item.status === 'resolved' ? 'Resolved' : 'Open'}</em></span></button>)}</div>{!items.length && <div className="admin-empty"><Inbox size={30} strokeWidth={1.2} /><h2>{search || kind ? 'No matching conversations.' : status === 'resolved' ? 'A clean slate.' : 'You’re all caught up.'}</h2><p>{search || kind ? 'Adjust the search or message type to find a conversation.' : status === 'resolved' ? 'Resolved messages will stay here for reference.' : 'Contact messages and feedback will appear here when they arrive.'}</p>{(search || kind) && <button className="btn btn-secondary btn-small" onClick={() => { setSearch(''); setKind(''); }}>Clear filters</button>}</div>}</>}
    <Dialog open={Boolean(selected)} onClose={() => !busy && setSelected(null)} title={selected?.subject || kinds[selected?.kind] || 'Message'} description={`${kinds[selected?.kind] || ''} · ${adminDate(selected?.created_at)}`}><div className="admin-feedback-detail"><p><strong>{selected?.name}</strong><a href={`mailto:${selected?.email || ''}`}>{selected?.email}</a></p><p className="admin-comment-body">{selected?.message}</p><AdminError message={actionError} /><div className="admin-dialog-actions"><a className="btn btn-secondary" href={`mailto:${selected?.email || ''}?subject=${encodeURIComponent('Re: ' + (selected?.subject || 'Your Vextra feedback'))}`}><Mail size={16} />Reply by email</a>{selected?.status !== 'resolved' && <button className="btn btn-primary" disabled={busy} onClick={resolve}><Check size={16} />{busy ? 'Resolving…' : 'Mark resolved'}</button>}</div></div></Dialog>
  </div>;
}
