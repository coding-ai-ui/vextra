import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { ArrowUpRight, Bell, Bookmark, Clock3, Compass, Layers3, MessageCircle, Sprout, TrendingUp } from 'lucide-react';
import api, { errorMessage } from '../Services/api';
import { useAuth } from '../context/AuthContext';
import { CountUp, EmptyState, Reveal } from './ui';
import { aggregatePortfolio } from '../utils/portfolio';
import { money, percent } from '../utils/formatters';

// oxlint-disable-next-line react/only-export-components -- Account pages share one cancellable data hook.
export function useAccountData(paths) {
  const { user } = useAuth();
  const key = JSON.stringify(paths);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState({ userId: null, data: null, error: '', refreshing: true });
  const reload = useCallback(() => { setResult((previous) => ({ ...previous, error: '', refreshing: true })); setRevision((value) => value + 1); }, []);
  useEffect(() => {
    window.addEventListener('vestra:data-changed', reload);
    return () => window.removeEventListener('vestra:data-changed', reload);
  }, [reload]);
  useEffect(() => {
    const controller = new AbortController();
    const endpoints = JSON.parse(key);
    Promise.all(Object.entries(endpoints).map(async ([name, path]) => [name, (await api.get(path, { signal: controller.signal })).data]))
      .then((entries) => { if (!controller.signal.aborted) setResult({ userId: user?.id, data: Object.fromEntries(entries), error: '', refreshing: false }); })
      .catch((reason) => { if (!controller.signal.aborted) setResult((previous) => ({ ...previous, userId: user?.id, error: errorMessage(reason), refreshing: false })); });
    return () => controller.abort();
  }, [key, revision, user?.id]);
  const sameUser = result.userId === user?.id;
  return { data: sameUser ? result.data : null, error: sameUser ? result.error : '', loading: !sameUser || (!result.data && result.refreshing), reload };
}

// oxlint-disable-next-line react/only-export-components -- Normalize the existing list API in one place.
export function asList(value) { return Array.isArray(value) ? value : value?.results || []; }

// oxlint-disable-next-line react/only-export-components -- Mutation announcements are shared across account pages.
export function announceAccountChange() { window.dispatchEvent(new Event('vestra:data-changed')); }

// oxlint-disable-next-line react/only-export-components -- Relative timestamps are shared across account lists.
export function relativeTime(value) {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp.getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr ago`;
  if (minutes < 10080) return `${Math.floor(minutes / 1440)} days ago`;
  return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function AccountNav() {
  return <nav className="account-section-nav" aria-label="Your workspace"><NavLink to="/dashboard"><Compass size={15} />Overview</NavLink><NavLink to="/portfolio"><Layers3 size={15} />Portfolio</NavLink><NavLink to="/saved"><Bookmark size={15} />Saved</NavLink><NavLink to="/following"><Bell size={15} />Following</NavLink></nav>;
}

export function AccountHeader({ eyebrow = 'YOUR VESTRA WORKSPACE', title, description, action }) {
  return <Reveal><header className="account-page-header"><div><div className="eyebrow"><span className="eyebrow-line" />{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</header></Reveal>;
}

export function AccountSkeleton({ rows = 3 }) {
  return <div className="account-skeleton" role="status" aria-label="Loading your workspace"><span className="sr-only">Loading your workspace.</span><div className="skeleton account-skeleton-banner" /><div className="account-skeleton-columns">{Array.from({ length: rows }, (_, index) => <div key={index} className="account-skeleton-panel"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div>)}</div></div>;
}

export function UserAvatar({ user, large = false }) {
  const [failed, setFailed] = useState(false);
  const name = user?.first_name || user?.username || 'Explorer';
  // Avatar URLs are optional. Initials remain useful when an image cannot load.
  const palette = ['sage', 'forest', 'violet', 'clay', 'amber'].includes(user?.avatar) ? user.avatar : 'sage';
  return <span className={`account-avatar avatar-${palette}${large ? ' account-avatar-large' : ''}`} aria-label={`${name}'s avatar`}>{/^https?:\/\//i.test(user?.avatar || '') && !failed ? <img src={user.avatar} alt="" onError={() => setFailed(true)} referrerPolicy="no-referrer" /> : name.slice(0, 2).toUpperCase()}</span>;
}

export function CompactProjects({ projects, emptyTitle = '', emptyMessage = '', limit = 3 }) {
  if (!projects.length) return <div className="account-quiet-empty"><Sprout size={23} strokeWidth={1.3} /><strong>{emptyTitle || 'A little room for possibility.'}</strong><p>{emptyMessage || 'Explore a project to begin making this space your own.'}</p><Link to="/projects" className="text-link">Explore projects <ArrowUpRight size={15} /></Link></div>;
  return <ul className="account-project-list">{projects.slice(0, limit).map((project) => <li key={project.id}><Link to={`/projects/${project.slug || project.id}`}><span className="account-project-letter" aria-hidden="true">{project.title.slice(0, 1)}</span><span><strong>{project.title}</strong><small>{project.category}{project.location ? ` · ${project.location}` : ''}</small></span><ArrowUpRight size={17} /></Link></li>)}</ul>;
}

const activityIcons = { saved: Bookmark, save: Bookmark, followed: Bell, follow: Bell, comment: MessageCircle, commented: MessageCircle, simulation: Layers3, simulate: Layers3, investment: Layers3 };
export function ActivityList({ activities, limit = 6 }) {
  if (!activities.length) return <div className="account-quiet-empty"><Clock3 size={23} strokeWidth={1.3} /><strong>Your story starts here.</strong><p>Saved ideas, conversations and simulations will appear as you explore.</p><Link to="/projects" className="text-link">Find your first idea <ArrowUpRight size={15} /></Link></div>;
  return <ol className="account-activity-list">{activities.slice(0, limit).map((activity) => {
    const Icon = activityIcons[activity.verb] || Sprout;
    const content = <><span className="account-activity-icon"><Icon size={15} /></span><span><strong>{activity.message}</strong><time dateTime={activity.created_at} title={new Date(activity.created_at).toLocaleString()}>{relativeTime(activity.created_at)}</time></span>{activity.url && <ArrowUpRight size={15} />}</>;
    return <li key={activity.id}>{activity.url?.startsWith('/') && !activity.url.startsWith('//') ? <Link to={activity.url}>{content}</Link> : <div>{content}</div>}</li>;
  })}</ol>;
}

export function AccountPanel({ title, eyebrow = '', to = '', linkLabel = 'View all', children, className = '' }) {
  return <section className={`account-panel ${className}`}><div className="account-panel-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{to && <Link to={to} className="text-link">{linkLabel}<ArrowUpRight size={15} /></Link>}</div>{children}</section>;
}

export function PortfolioEmpty() {
  return <Reveal><section className="portfolio-empty"><div className="empty-portfolio-art" aria-hidden="true"><span className="empty-orbit orbit-one" /><span className="empty-orbit orbit-two" /><div className="empty-idea-card empty-idea-back"><Sprout size={28} /><span>One small idea.</span></div><div className="empty-idea-card empty-idea-front"><span className="eyebrow">YOUR NEXT CHAPTER</span><strong>$0<span>.00</span></strong><div className="empty-art-line" /><span>A world of possibility <ArrowUpRight size={14} /></span></div></div><div className="eyebrow">START WITH CURIOSITY</div><h2>Your portfolio starts<br />with <span className="serif-emphasis">one idea.</span></h2><p>Explore fictional projects and save your first simulation. A clearer understanding starts with a little exploration.</p><Link to="/projects" className="btn btn-primary">Find your first project <ArrowUpRight size={18} /></Link><span className="empty-portfolio-footnote">No real funds. Just possibilities.</span></section></Reveal>;
}

export function CollectionEmpty({ following = false }) {
  return <EmptyState title={following ? "You aren't following any projects yet." : "You haven't saved any projects yet."} action={<Link to="/projects" className="btn btn-primary">Explore projects<ArrowUpRight size={17} /></Link>}>{following ? 'Follow an idea that interests you. Project updates will reach your notifications, and you can continue exploring from here.' : 'A promising idea deserves a place to return to. Use the bookmark on any project to keep it in your collection.'}</EmptyState>;
}

export function PortfolioSummary({ investments }) {
  const totals = useMemo(() => aggregatePortfolio(investments), [investments]);
  return <><div className="portfolio-summary-grid">
    <Reveal className="portfolio-value-reveal"><section className="portfolio-value-panel" aria-label="Estimated portfolio value"><div className="portfolio-value-top"><span>ESTIMATED PORTFOLIO VALUE</span><span className="portfolio-simulation-pill"><span />Simulation</span></div><div className="portfolio-dominant-value"><CountUp value={totals.value} format={money} /></div><div className="portfolio-expected-gain"><span><TrendingUp size={15} />{totals.profit >= 0 ? '+' : ''}{money(totals.profit)}</span><span>in simulated gain / loss</span></div><div className="portfolio-value-bottom"><span>A little perspective.<br /><strong>A bigger picture.</strong></span><svg className="portfolio-value-art" viewBox="0 0 240 90" fill="none" aria-hidden="true"><ellipse cx="150" cy="48" rx="70" ry="31" stroke="#b6c797" strokeOpacity=".25" /><ellipse cx="150" cy="48" rx="48" ry="31" stroke="#d8bc80" strokeOpacity=".5" /><ellipse cx="150" cy="48" rx="23" ry="31" stroke="#d8bc80" strokeOpacity=".7" /><path d="M80 48h140" stroke="#b6c797" strokeOpacity=".25" /><circle cx="150" cy="48" r="4" fill="#d8bc80" /></svg></div></section></Reveal>
    <div className="portfolio-supporting-metrics"><Reveal delay={50}><section className="portfolio-stat"><span className="portfolio-stat-icon"><Layers3 size={18} /></span><span className="metric-label">Total allocated</span><strong><CountUp value={totals.invested} format={money} /></strong><span className="portfolio-stat-context">Across {investments.length} saved {investments.length === 1 ? 'simulation' : 'simulations'}</span></section></Reveal><Reveal delay={100}><section className="portfolio-stat"><span className="portfolio-stat-icon"><TrendingUp size={18} /></span><span className="metric-label">Average expected return</span><strong><CountUp value={totals.weighted} format={percent} /></strong><span className="portfolio-stat-context">Weighted by simulated amount</span></section></Reveal><Reveal delay={150}><section className="portfolio-stat portfolio-stat-projects"><div><span className="metric-label">Ideas in your portfolio</span><strong><CountUp value={totals.projectCount} /><small> {totals.projectCount === 1 ? 'project' : 'projects'}</small></strong></div><Link to="/projects" aria-label="Discover more projects"><ArrowUpRight size={22} /></Link></section></Reveal></div>
  </div><div className="dashboard-estimate-note"><span />Simulation estimate — not a guaranteed return. No real money is invested.</div></>;
}
