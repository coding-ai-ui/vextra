import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Bell, Check, CheckCheck } from 'lucide-react';
import api, { errorMessage } from '../Services/api';
import { useToast } from '../context/ToastContext';
import { EmptyState, ErrorState, Reveal } from '../Components/ui';
import { AccountHeader, AccountSkeleton, announceAccountChange, asList, relativeTime, useAccountData } from '../Components/AccountComponents';

export default function Notifications() {
  const { data, loading, error, reload } = useAccountData({ notifications: '/community/notifications/' });
  const notifications = useMemo(() => asList(data?.notifications), [data]);
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(null);
  const inFlight = useRef(false);
  const { toast } = useToast();
  const unread = notifications.filter((item) => !item.read).length;
  const displayed = filter === 'unread' ? notifications.filter((item) => !item.read) : notifications;
  async function markRead(item) {
    if (inFlight.current || item?.read) return;
    inFlight.current = true; setBusy(item ? item.id : 'all');
    try {
      if (item) await api.patch(`/community/notifications/${item.id}/`, { read: true });
      else await api.post('/community/notifications/read-all/');
      announceAccountChange();
      if (!item) toast({ title: 'All caught up', message: 'Your notifications are marked as read.' });
    } catch (reason) { toast({ title: 'Could not update notifications', message: errorMessage(reason) }); }
    finally { inFlight.current = false; setBusy(null); }
  }
  return <div className="container account-page notifications-page"><AccountHeader eyebrow="YOUR IDEAS KEEP MOVING" title={<>A little <span className="serif-emphasis">news.</span></>} description="Project updates, thoughtful replies and the conversations you're part of. All in one place." action={<Link to="/settings" className="btn btn-secondary">Notification preferences<ArrowUpRight size={17} /></Link>} />
    {loading ? <AccountSkeleton rows={2} /> : error ? <ErrorState message={error} onRetry={reload} /> : <><div className="notification-controls"><div className="account-segmented" role="group" aria-label="Filter notifications"><button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All updates<span>{notifications.length}</span></button><button type="button" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>Unread<span>{unread}</span></button></div><button type="button" className="text-link" onClick={() => markRead(null)} disabled={!unread || busy !== null}><CheckCheck size={16} />{busy === 'all' ? 'Marking as read…' : 'Mark all as read'}</button></div>
      {displayed.length ? <Reveal><ul className="notification-list">{displayed.map((item) => {
        const hasLink = item.url?.startsWith('/') && !item.url.startsWith('//');
        return <li key={item.id} className={item.read ? '' : 'is-unread'}><span className="notification-entry-icon" aria-hidden="true"><Bell size={18} /></span><div className="notification-entry-content"><div className="notification-title-row"><h2>{hasLink ? <Link to={item.url} onClick={() => { if (!item.read) markRead(item); }}>{item.title}<ArrowUpRight size={16} /></Link> : item.title}</h2>{!item.read && <span className="notification-unread-dot"><span className="sr-only">Unread</span></span>}</div><p>{item.message}</p><time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()}>{relativeTime(item.created_at)}</time></div>{!item.read && <button type="button" className="icon-button" onClick={() => markRead(item)} aria-label={`Mark ${item.title} as read`} title="Mark as read" disabled={busy !== null}>{busy === item.id ? <span className="auth-spinner" /> : <Check size={17} />}</button>}</li>;
      })}</ul></Reveal> : <EmptyState title={filter === 'unread' ? "You're all caught up." : 'A little quiet, for now.'} action={<Link to={filter === 'unread' && notifications.length ? '/following' : '/projects'} className="btn btn-primary">{filter === 'unread' && notifications.length ? 'Projects you follow' : 'Explore projects'}<ArrowUpRight size={17} /></Link>}>{filter === 'unread' ? 'No unread updates. Come back when your next conversation or project update arrives.' : 'Follow a project or join a discussion. Updates and replies will find their way here.'}</EmptyState>}
    </>}
  </div>;
}
