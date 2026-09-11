import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, Check, Info, LoaderCircle, LockKeyhole } from 'lucide-react';
import api, { errorMessage } from '../Services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useProduct } from '../context/ProductContext';
import { money, percent } from '../utils/formatters';
import { calculateSimulation, parseSimulationAmount } from '../utils/portfolio';

function savedAmount(projectId, resumed) {
  if (resumed?.projectId === projectId && typeof resumed.amount === 'string') return resumed.amount;
  try { return sessionStorage.getItem(`vestra:simulation:${projectId}`) || '1000'; }
  catch { return '1000'; }
}

export default function InvestmentSimulator({ project }) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const { requireLogin } = useProduct();
  const navigate = useNavigate();
  const location = useLocation();
  const [amount, setAmount] = useState(() => savedAmount(project.id, location.state?.simulation));
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [allocated, setAllocated] = useState(isAuthenticated ? null : 0);
  useEffect(() => { if (!isAuthenticated) return; const controller = new AbortController(); api.get('/investments/', { signal: controller.signal }).then(({ data }) => setAllocated(data.reduce((total, item) => total + Math.round(Number(item.amount) * 100), 0))).catch(() => { /* The simulation can still be saved; unknown allocation is not invented. */ }); return () => controller.abort(); }, [isAuthenticated]);
  const savingRef = useRef(false);
  const simulatorRef = useRef(null);
  useEffect(() => {
    if (location.hash !== '#simulator') return;
    const frame = requestAnimationFrame(() => simulatorRef.current?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [location.hash]);
  const parsed = parseSimulationAmount(amount);
  const { profitCents, totalCents } = calculateSimulation(parsed.cents, project.expected_return);
  const total = totalCents / 100;
  const chooseAmount = (value) => { setAmount(value); setTouched(true); setSaved(false); setSaveError(''); };

  const saveSimulation = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (parsed.error || savingRef.current) return;
    try { sessionStorage.setItem(`vestra:simulation:${project.id}`, amount); } catch { /* Storage is optional. */ }
    if (!isAuthenticated) {
      requireLogin('simulate', project);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await api.post('/investments/', { project_id: project.id, amount: (parsed.cents / 100).toFixed(2) });
      setSaved(true);
      window.dispatchEvent(new Event('vestra:data-changed'));
      try { sessionStorage.removeItem(`vestra:simulation:${project.id}`); } catch { /* Storage is optional. */ }
      toast({ title: 'Added to your portfolio', message: `${project.title} simulation has been saved.`, action: { label: 'View portfolio', to: '/portfolio' } });
    } catch (reason) {
      setSaveError(errorMessage(reason));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <section className="investment-simulator" id="simulator" ref={simulatorRef}>
      <div className="simulator-topline"><span className="eyebrow">THE POSSIBILITIES, IN NUMBERS</span><span className="simulator-live"><span /> Live estimate</span></div>
      <h2>What could your<br /><span className="serif-emphasis">next move look like?</span></h2>
      <p className="simulator-intro">Try an amount. Explore the potential.</p>
      <form onSubmit={saveSimulation} noValidate>
        <label className="simulator-amount-label" htmlFor="simulation-amount">Simulated investment amount</label>
        <div className={`simulator-amount-input ${touched && parsed.error ? 'has-error' : ''}`}><span aria-hidden="true">$</span><input id="simulation-amount" type="text" inputMode="decimal" autoComplete="off" value={amount} disabled={saving} onChange={(event) => chooseAmount(event.target.value)} onBlur={() => setTouched(true)} aria-invalid={Boolean(touched && parsed.error)} aria-describedby={touched && parsed.error ? 'simulation-amount-error' : 'simulation-amount-help'} /><span className="amount-currency">USD</span></div>
        {touched && parsed.error ? <p className="field-error" id="simulation-amount-error" role="alert">{parsed.error}</p> : <span id="simulation-amount-help" className="sr-only">Enter up to one million dollars with no more than two decimal places. No real money is involved.</span>}
        <div className="simulator-quick-amounts" aria-label="Quick simulation amounts">{[500, 1000, 2500, 5000].map((value) => <button type="button" key={value} disabled={saving} className={Number(amount) === value ? 'selected' : ''} aria-pressed={Number(amount) === value} onClick={() => chooseAmount(String(value))}>{money(value)}</button>)}</div>
        <div className="simulation-breakdown"><div><span>Expected return</span><strong>{percent(project.expected_return)}<ArrowUpRight size={14} /></strong></div><div><span>Simulation period</span><strong>{project.duration} months</strong></div></div>
        <div className="simulation-breakdown"><div><span>Allocation after addition</span><strong>{allocated === null ? 'Available in your portfolio' : percent(parsed.cents > 0 ? parsed.cents / (allocated + parsed.cents) * 100 : 0)}</strong></div></div>
        <div className="simulation-result" aria-live="polite" aria-atomic="true">
          <div className="simulation-profit"><span>Expected profit</span><strong>+{money(profitCents / 100)}</strong></div>
          <div className="simulation-total"><span>Estimated total value</span><strong key={total}>{money(total)}</strong></div>
          <div className="simulation-value-bar" aria-hidden="true"><span style={{ width: `${total > 0 ? (parsed.cents / 100 / total) * 100 : 100}%` }} /><span /></div>
          <div className="simulation-value-legend"><span><i />Your amount</span><span><i />Expected profit</span></div>
        </div>
        {saveError && <p className="simulator-save-error" role="alert">{saveError}</p>}
        {saved ? <div className="simulator-saved" role="status"><span><Check size={17} /> Simulation saved</span><button type="button" className="btn btn-primary" onClick={() => navigate('/portfolio')}>View your portfolio <ArrowUpRight size={17} /></button><button type="button" className="text-link save-another" onClick={() => { setAllocated(current => current === null ? null : current + parsed.cents); setSaved(false); }}>Create another simulation</button></div> : <button type="submit" className="btn btn-primary simulator-submit" disabled={saving || (touched && Boolean(parsed.error))}>{saving ? <><LoaderCircle size={17} className="spin" /> Saving simulation...</> : isAuthenticated ? <>Add to simulated portfolio <ArrowUpRight size={17} /></> : <>Sign in to save simulation <ArrowUpRight size={17} /></>}</button>}
      </form>
      <p className="simulator-disclaimer"><Info size={15} /><span>Simulation estimate — not a guaranteed return.</span></p>
      <div className="simulator-security"><LockKeyhole size={13} /><span>For educational demonstration only. No real money.</span></div>
    </section>
  );
}
