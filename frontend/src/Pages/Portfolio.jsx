import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, ChartNoAxesCombined, Leaf, Pencil, Plus, Trash2 } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { errorMessage } from '../Services/api';
import { useToast } from '../context/ToastContext';
import Dialog, { ConfirmDialog } from '../Components/Dialog';
import PortfolioCharts from '../Components/PortfolioCharts';
import { CountUp, ErrorState, Reveal, RiskBadge } from '../Components/ui';
import { AccountHeader, AccountNav, AccountPanel, AccountSkeleton, PortfolioEmpty, PortfolioSummary, announceAccountChange, asList, useAccountData } from '../Components/AccountComponents';
import { aggregatePortfolio, calculateSimulation, parseSimulationAmount, toCents } from '../utils/portfolio';
import { date, money, percent } from '../utils/formatters';

function HistoryTooltip({ active = false, payload = [] }) {
  if (!active || !payload?.length) return null;
  return <div className="vestra-chart-tooltip"><strong>{new Date(payload[0].payload.date).toLocaleString()}</strong>{payload.map((entry) => <div key={entry.dataKey}><span><i style={{ background: entry.color }} />{entry.name}</span><b>{money(entry.value)}</b></div>)}</div>;
}

function ValueHistory({ history }) {
  const points = history.map((entry, index) => ({ ...entry, index, allocated: Number(entry.allocated), value: Number(entry.value) }));
  return <AccountPanel title="Your decisions, over time" eyebrow="SIMULATED VALUE HISTORY" className="portfolio-history-panel"><p className="account-panel-intro">A record of your saved allocations and edits. Changes reflect your decisions, not market performance.</p>{points.length ? <><div className="bar-chart-legend"><span><i />Allocated amount</span><span><i />Estimated value</span></div><div className="portfolio-history-chart" aria-hidden="true"><ResponsiveContainer width="100%" height={270} minWidth={0}><LineChart data={points} margin={{ top: 15, right: 16, bottom: 0, left: 0 }} accessibilityLayer={false}><CartesianGrid stroke="#e6ebe2" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="index" axisLine={false} tickLine={false} minTickGap={45} tick={{ fontSize: 11, fill: '#657267' }} tickFormatter={(index) => new Date(points[index]?.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} /><YAxis axisLine={false} tickLine={false} width={65} tick={{ fontSize: 11, fill: '#657267' }} tickFormatter={(value) => money(value, true)} /><Tooltip content={<HistoryTooltip />} /><Line type="stepAfter" dataKey="allocated" name="Allocated amount" stroke="#9bb49a" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} /><Line type="stepAfter" dataKey="value" name="Estimated value" stroke="#164d3b" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div><div className="sr-only chart-data-accessible"><table><caption>Actual saved portfolio snapshots</caption><thead><tr><th scope="col">Date</th><th scope="col">Allocated amount</th><th scope="col">Estimated value</th></tr></thead><tbody>{points.map((point) => <tr key={point.index}><th scope="row">{new Date(point.date).toLocaleString()}</th><td>{money(point.allocated)}</td><td>{money(point.value)}</td></tr>)}</tbody></table></div></> : <p className="account-history-empty">Your first saved allocation will create the first point in your history.</p>}</AccountPanel>;
}

function AllocationEditor({ investment, total, onClose, onSaved }) {
  const [amount, setAmount] = useState(String(investment.amount));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const { toast } = useToast();
  const parsed = parseSimulationAmount(amount);
  const scenario = calculateSimulation(parsed.cents, investment.expected_return_snapshot);
  const revisedTotal = toCents(total) - toCents(investment.amount) + parsed.cents;
  async function save(event) {
    event.preventDefault();
    if (inFlight.current) return;
    if (parsed.error) { setError(parsed.error); return; }
    inFlight.current = true; setBusy(true); setError('');
    try {
      await api.patch(`/investments/${investment.id}/`, { amount: (parsed.cents / 100).toFixed(2) });
      toast({ title: 'Portfolio updated', message: `Your ${investment.project.title} allocation has been adjusted.` });
      announceAccountChange(); onSaved();
    } catch (reason) { setError(errorMessage(reason, 'We could not update this allocation. Please try again.')); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <Dialog open onClose={() => !busy && onClose()} title="Refine your allocation" description="A small change. A new perspective."><form onSubmit={save} className="account-dialog-form" noValidate aria-busy={busy}><div className="account-dialog-project"><span className="account-project-letter" aria-hidden="true">{investment.project.title[0]}</span><div><strong>{investment.project.title}</strong><span>{investment.project.category}</span></div></div><div className="form-field"><label htmlFor="edit-allocation-amount">Simulated amount (USD)</label><input id="edit-allocation-amount" className={`input${error ? ' input-invalid' : ''}`} value={amount} onChange={(event) => { setAmount(event.target.value); setError(''); }} inputMode="decimal" autoComplete="off" disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? 'edit-allocation-error' : undefined} autoFocus required />{error && <p id="edit-allocation-error" className="field-error" role="alert">{error}</p>}</div><div className="account-scenario-preview"><div><span>Portfolio share after change</span><strong>{!parsed.error && revisedTotal > 0 ? percent(parsed.cents / revisedTotal * 100) : '—'}</strong></div><div><span>Original scenario return</span><strong>{percent(investment.expected_return_snapshot)}</strong></div><div><span>Expected profit</span><strong>{parsed.error ? '—' : money(scenario.profitCents / 100)}</strong></div><div><span>Estimated total</span><strong>{parsed.error ? '—' : money(scenario.totalCents / 100)}</strong></div></div><p className="account-simulation-note">Simulation only — no real money is being invested. Your original return scenario is preserved.</p><div className="account-dialog-actions"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Updating…' : 'Update allocation'}<ArrowUpRight size={16} /></button></div></form></Dialog>;
}

export default function Portfolio() {
  const { data, error, loading, reload } = useAccountData({ investments: '/investments/', history: '/investments/history/' });
  const investments = useMemo(() => asList(data?.investments), [data]);
  const totals = useMemo(() => aggregatePortfolio(investments), [investments]);
  const impact = useMemo(() => {
    let weighted = 0; let assessed = 0;
    const areas = new Map();
    for (const investment of investments) {
      const amount = toCents(investment.amount);
      const score = investment.project.impact_score;
      if (score !== null && score !== undefined && Number.isFinite(Number(score))) { weighted += amount * Number(score); assessed += amount; }
      const area = investment.project.impact_area || investment.project.category || 'Unspecified';
      areas.set(area, (areas.get(area) || 0) + amount);
    }
    return { score: assessed ? weighted / assessed : null, areas: [...areas].map(([name, cents]) => ({ name, amount: cents / 100 })).sort((a, b) => b.amount - a.amount) };
  }, [investments]);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const removingRef = useRef(false);
  const { toast } = useToast();
  async function remove() {
    if (removingRef.current || !removing) return;
    removingRef.current = true; setBusy(true); setRemoveError('');
    try {
      await api.delete(`/investments/${removing.id}/`);
      toast({ title: 'Allocation removed', message: 'Your simulated portfolio has been updated.' });
      setRemoving(null); announceAccountChange();
    } catch (reason) { setRemoveError(errorMessage(reason, 'We could not remove this allocation. Please try again.')); }
    finally { removingRef.current = false; setBusy(false); }
  }
  return <div className="container account-page portfolio-page"><AccountHeader eyebrow="YOUR IDEAS, IN PERSPECTIVE" title={<>A portfolio of <span className="serif-emphasis">possibilities.</span></>} description="Explore how your decisions fit together. Every allocation is fictional; the perspective is yours to keep." action={<Link to="/projects" className="btn btn-primary"><Plus size={17} />Explore projects</Link>} /><AccountNav />
    {loading ? <AccountSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : <>
      {!investments.length ? <PortfolioEmpty /> : <><PortfolioSummary investments={investments} /><div className="portfolio-insight-grid"><Reveal><section className="portfolio-insight"><ChartNoAxesCombined size={21} /><div><span className="metric-label">Diversification</span><strong>{totals.categories.length}<small> {totals.categories.length === 1 ? 'category' : 'categories'}</small></strong><p>{percent(Math.max(...totals.categories.map((category) => category.value / totals.invested * 100)))} in your largest category</p></div></section></Reveal><Reveal delay={65}><section className="portfolio-insight"><Leaf size={21} /><div><span className="metric-label">Weighted impact score</span><strong>{impact.score === null ? 'Not assessed' : <><CountUp value={impact.score} format={(value) => value.toFixed(1)} /><small> / 100</small></>}</strong><p>Project impact scores, weighted by allocation</p></div><Link to="/faq" className="icon-button" aria-label="How impact scores work"><ArrowUpRight size={17} /></Link></section></Reveal></div><PortfolioCharts investments={investments} />
      <div className="account-two-columns portfolio-secondary-charts"><Reveal><ValueHistory history={asList(data?.history)} /></Reveal><Reveal delay={60}><AccountPanel title="Where your ideas lead" eyebrow="IMPACT DISTRIBUTION"><p className="account-panel-intro">The impact areas represented by your simulated allocations.</p><ul className="portfolio-impact-list">{impact.areas.map((area) => <li key={area.name}><div><strong>{area.name}</strong><span>{percent(area.amount / totals.invested * 100)}</span></div><div className="portfolio-impact-track" aria-hidden="true"><span style={{ width: `${area.amount / totals.invested * 100}%` }} /></div><small>{money(area.amount)} allocated</small></li>)}</ul><p className="chart-footnote">Impact scores describe the educational project's stated potential. They are not an independent investment rating.</p></AccountPanel></Reveal></div>
      <Reveal><AccountPanel title="Your allocations" eyebrow="EACH IDEA HAS A PLACE" className="portfolio-allocations-panel"><p className="account-panel-intro">Adjust a scenario to explore a different balance. Repeated projects are combined in your charts.</p><div className="portfolio-allocation-table-wrap"><table className="portfolio-allocation-table"><thead><tr><th scope="col">Project</th><th scope="col">Allocated</th><th scope="col">Scenario return</th><th scope="col">Portfolio share</th><th scope="col">Estimated value</th><th scope="col"><span className="sr-only">Allocation actions</span></th></tr></thead><tbody>{investments.map((investment) => <tr key={investment.id}><td className="portfolio-allocation-project"><Link to={`/projects/${investment.project.slug || investment.project.id}`}><span className="account-project-letter" aria-hidden="true">{investment.project.title[0]}</span><span><strong>{investment.project.title}</strong><small>{investment.project.category}</small></span></Link><span className="portfolio-allocation-date">Added {date(investment.created_at)}</span></td><td data-label="Allocated"><strong>{money(investment.amount)}</strong></td><td data-label="Scenario return"><span>{percent(investment.expected_return_snapshot)}</span><RiskBadge risk={investment.project.risk_level} /></td><td data-label="Portfolio share">{percent(Number(investment.amount) / totals.invested * 100)}</td><td data-label="Estimated value"><strong>{money((toCents(investment.amount) + toCents(investment.expected_profit)) / 100)}</strong></td><td className="portfolio-allocation-actions"><button type="button" className="icon-button" title="Change allocation" aria-label={`Change allocation for ${investment.project.title}, ${money(investment.amount)}`} onClick={() => setEditing(investment)}><Pencil size={16} /></button><button type="button" className="icon-button account-danger-icon" title="Remove allocation" aria-label={`Remove allocation for ${investment.project.title}, ${money(investment.amount)}`} onClick={() => { setRemoveError(''); setRemoving(investment); }}><Trash2 size={16} /></button><Link className="icon-button" title="View project" aria-label={`View ${investment.project.title}`} to={`/projects/${investment.project.slug || investment.project.id}`}><ArrowUpRight size={17} /></Link></td></tr>)}</tbody></table></div></AccountPanel></Reveal></>}
      {!investments.length && asList(data?.history).length > 0 && <Reveal><ValueHistory history={asList(data.history)} /></Reveal>}
    </>}
    {editing && <AllocationEditor key={editing.id} investment={editing} total={totals.invested} onClose={() => setEditing(null)} onSaved={() => setEditing(null)} />}
    <ConfirmDialog open={Boolean(removing)} onClose={() => !busy && setRemoving(null)} onConfirm={remove} busy={busy} title="Remove this allocation?" description={<>{removing ? `The ${money(removing.amount)} simulation for ${removing.project.title} will be removed from your portfolio. You can create a new simulation any time.` : ''}{removeError && <span className="field-error account-block" role="alert">{removeError}</span>}</>} confirmLabel="Remove allocation" />
  </div>;
}
