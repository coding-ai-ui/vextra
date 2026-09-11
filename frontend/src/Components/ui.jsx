import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Sprout } from 'lucide-react';

// oxlint-disable-next-line react/only-export-components -- Shared motion primitives intentionally live together.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReduced(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  return reduced;
}
export function Reveal({ children, className = '', delay = 0, variant = 'fade-up' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => { const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }, { threshold: .08, rootMargin: '0px 0px -24px 0px' }); if (ref.current) observer.observe(ref.current); return () => observer.disconnect(); }, []);
  return <div ref={ref} className={`reveal reveal-${variant} ${visible || reduced ? 'is-visible' : ''} ${className}`} style={{ '--reveal-delay': `${delay}ms` }}>{children}</div>;
}
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString(), className = '' }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(0);
  const [visible, setVisible] = useState(false);
  const reduced = useReducedMotion();
  useEffect(() => { const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } }); if (ref.current) observer.observe(ref.current); return () => observer.disconnect(); }, []);
  useEffect(() => { if (!visible || reduced) return; let frame; const start = performance.now(); const target = Number(value) || 0; const tick = (now) => { const t = Math.min((now - start) / 1100, 1); setDisplay(target * (1 - (1 - t) ** 3)); if (t < 1) frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame); }, [value, visible, reduced]);
  return <span className={className} ref={ref} role="img" aria-label={format(value)}><span aria-hidden="true">{format(reduced ? value : display)}</span></span>;
}
export function RiskBadge({ risk }) { return <span className={`risk-badge risk-${String(risk).toLowerCase()}`}><span />{risk} risk</span>; }
export function ProgressBar({ value }) { return <Reveal className="progress-reveal"><div className="progress-track" role="progressbar" aria-label="Fictional funding progress" aria-valuenow={Math.min(100, Math.max(0, Number(value) || 0))} aria-valuemin={0} aria-valuemax={100}><span style={{ '--progress': `${Math.min(100, Math.max(0, Number(value) || 0))}%` }} /></div></Reveal>; }
export function EmptyState({ title, children = null, action = null }) { return <div className="empty-state"><div className="empty-art"><Sprout size={38} strokeWidth={1.2} /><span /><span /></div><h2>{title}</h2><div className="muted">{children}</div>{action}</div>; }
export function ErrorState({ message, onRetry }) { return <div className="error-state" role="alert"><h3>Let’s try that again.</h3><p>{message || 'We couldn’t connect to Vestra. Please try again in a moment.'}</p>{onRetry && <button className="btn btn-secondary btn-small" onClick={onRetry}><RotateCcw size={15} />Try again</button>}</div>; }
export function LoadingState({ cards = 3 }) { return <div className="skeleton-grid" role="status" aria-label="Loading"><span className="sr-only">Loading, please wait.</span>{Array.from({ length: cards }, (_, i) => <div className="skeleton-card" key={i}><div className="skeleton skeleton-visual" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /><div className="skeleton skeleton-metric" /></div>)}</div>; }
