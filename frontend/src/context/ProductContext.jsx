import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api, { errorMessage } from '../Services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import Dialog from '../Components/Dialog';

const ProductContext = createContext(null);
const compareKey = 'vestra:comparison';
function storedComparison() { try { const data = JSON.parse(localStorage.getItem(compareKey)); return Array.isArray(data) ? data.filter(p => p?.id).slice(0, 4) : []; } catch { return []; } }
export function ProductProvider({ children }) {
  const { user } = useAuth();
  return <ProductSession key={user?.id || 'visitor'}>{children}</ProductSession>;
}
function ProductSession({ children }) {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [saved, setSaved] = useState([]);
  const [following, setFollowing] = useState([]);
  const [comparison, setComparison] = useState(() => user?.id ? [] : storedComparison());
  const [comparisonBusy, setComparisonBusy] = useState(Boolean(user?.id));
  const [comparisonError, setComparisonError] = useState('');
  const [comparisonRevision, setComparisonRevision] = useState(0);
  const [notifications, setNotifications] = useState({ results: [], unread_count: 0 });
  const [notificationError, setNotificationError] = useState('');
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [loginIntent, setLoginIntent] = useState(null);
  const [busy, setBusy] = useState({});
  const lock = useRef(new Set());
  const session = useRef(user?.id);
  useEffect(() => { session.current = user?.id; return () => { session.current = null; }; }, [user?.id]);
  const refreshNotifications = useCallback(async () => {
    if (!user?.id) return;
    const id = user.id;
    setNotificationLoading(true);
    try { const { data } = await api.get('/community/notifications/'); if (session.current === id) { setNotifications(data); setNotificationError(''); } }
    catch (error) { if (session.current === id) setNotificationError(errorMessage(error)); }
    finally { if (session.current === id) setNotificationLoading(false); }
  }, [user?.id]);
  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    const refresh = () => {
      Promise.allSettled([api.get('/community/saved/'), api.get('/community/following/')]).then(results => {
        if (!active) return;
        if (results[0].status === 'fulfilled') setSaved(results[0].value.data);
        if (results[1].status === 'fulfilled') setFollowing(results[1].value.data);
      });
      refreshNotifications();
    };
    refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refreshNotifications(); }, 30000);
    window.addEventListener('vestra:data-changed', refresh);
    return () => { active = false; clearInterval(timer); window.removeEventListener('vestra:data-changed', refresh); };
  }, [user?.id, refreshNotifications]);
  useEffect(() => {
    if (!user?.id) return;
    const controller = new AbortController();
    api.get('/community/comparison/', { signal: controller.signal }).then(({ data }) => { setComparison(data); setComparisonError(''); }).catch(error => { if (!controller.signal.aborted) setComparisonError(errorMessage(error)); }).finally(() => { if (!controller.signal.aborted) setComparisonBusy(false); });
    return () => controller.abort();
  }, [user?.id, comparisonRevision]);
  const requireLogin = (action, project) => setLoginIntent({ action, project, from: `${location.pathname}${location.search}${action === 'comment' ? '#discussion' : action === 'simulate' ? '#simulator' : location.hash}` });
  const toggleProject = async (type, project, force = false) => {
    if (!isAuthenticated) { requireLogin(type, project); return; }
    const key = `${type}:${project.id}`;
    if (lock.current.has(key)) return;
    lock.current.add(key); setBusy(state => ({ ...state, [key]: true }));
    const list = type === 'save' ? saved : following;
    const exists = list.some(p => p.id === project.id);
    const removing = exists && !force;
    const owner = user.id;
    try {
      await api[removing ? 'delete' : 'post'](`/projects/${project.id}/${type}/`);
      if (session.current !== owner) return;
      const setter = type === 'save' ? setSaved : setFollowing;
      setter(current => removing ? current.filter(p => p.id !== project.id) : [...current.filter(p => p.id !== project.id), project]);
      toast({ title: type === 'save' ? removing ? 'Removed from saved projects' : 'Project saved' : removing ? 'Project unfollowed' : 'Following project', message: project.title });
      window.dispatchEvent(new Event('vestra:data-changed'));
    } catch (error) { toast({ title: 'Could not update project', message: errorMessage(error) }); }
    finally { lock.current.delete(key); setBusy(state => ({ ...state, [key]: false })); }
  };
  useEffect(() => {
    if (!isAuthenticated) return;
    let intent;
    try { intent = JSON.parse(sessionStorage.getItem('vestra:pending-action')); sessionStorage.removeItem('vestra:pending-action'); } catch { return; }
    if (intent?.project && ['save', 'follow'].includes(intent.action)) toggleProject(intent.action, intent.project, true);
    // Resume an explicitly requested save/follow exactly once after sign-in.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);
  const toggleCompare = async project => {
    if (comparisonBusy || lock.current.has('comparison')) return;
    if (comparisonError) { toast({ title: 'Comparison is unavailable', message: comparisonError, action: { label: 'Try again', to: '/compare' } }); return; }
    const exists = comparison.some(p => p.id === project.id);
    if (!exists && comparison.length >= 4) { toast({ title: 'Four ideas at a time', message: 'Remove a project from comparison to add another.' }); return; }
    const next = exists ? comparison.filter(p => p.id !== project.id) : [...comparison, project];
    lock.current.add('comparison'); setComparisonBusy(true);
    try {
      if (isAuthenticated) {
        const { data } = await api.put('/community/comparison/', { project_ids: next.map(item => item.id) });
        if (session.current !== user.id) return;
        setComparison(data);
      } else {
        setComparison(next);
        try { localStorage.setItem(compareKey, JSON.stringify(next)); } catch { /* Guest comparison works in memory if storage is unavailable. */ }
      }
      toast({ title: exists ? 'Removed from comparison' : 'Project added to comparison', action: next.length >= 2 ? { label: 'Compare projects', to: '/compare' } : undefined });
    } catch (error) { toast({ title: 'Could not update comparison', message: errorMessage(error) }); }
    finally { lock.current.delete('comparison'); setComparisonBusy(false); }
  };
  const rememberIntent = () => { if (loginIntent?.project) { try { sessionStorage.setItem('vestra:pending-action', JSON.stringify(loginIntent)); } catch { /* Destination still persists in router state. */ } } setLoginIntent(null); };
  return <ProductContext.Provider value={{ saved, following, comparison, comparisonBusy, comparisonError, retryComparison: () => setComparisonRevision(value => value + 1), toggleCompare, toggleProject, busy, requireLogin, notifications, notificationError, notificationLoading, refreshNotifications }}>
    {children}
    <Dialog open={Boolean(loginIntent)} onClose={() => setLoginIntent(null)} title={loginIntent?.action === 'comment' ? 'Join the discussion.' : 'Make this possibility yours.'} description="Sign in to save ideas, follow their progress, and build your own simulated portfolio."><div className="login-dialog-art" aria-hidden="true">v.</div><div className="dialog-actions"><Link to="/login" state={{ from: loginIntent?.from }} className="btn btn-primary" onClick={rememberIntent}>Log in</Link><Link to="/register" state={{ from: loginIntent?.from }} className="btn btn-secondary" onClick={rememberIntent}>Create an account</Link></div><p className="dialog-footnote">A space to explore. No real money, ever.</p></Dialog>
  </ProductContext.Provider>;
}
// oxlint-disable-next-line react/only-export-components
export function useProduct() { return useContext(ProductContext); }
