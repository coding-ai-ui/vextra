import { useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { ArrowUpRight } from 'lucide-react';
import { money, percent } from '../utils/formatters';
import { Reveal } from './ui';
import { aggregatePortfolio } from '../utils/portfolio';

const colors = ['#164d3b', '#6c9274', '#d4a853', '#a9beb0', '#567a76', '#bca47d', '#65745a'];

function ChartTooltip({ active = false, payload = [], label = '' }) {
  if (!active || !payload?.length) return null;
  return <div className="vestra-chart-tooltip"><strong>{payload[0]?.payload?.fullName || label || payload[0].name}</strong>{payload.map((item, index) => <div key={`${item.name}-${index}`}><span><i style={{ background: item.color || item.payload.fill }} />{item.name === 'value' ? 'Simulated amount' : item.name}</span><b>{money(item.value)}</b></div>)}</div>;
}

export default function PortfolioCharts({ investments }) {
  const { categories, projects, invested: total } = useMemo(() => aggregatePortfolio(investments), [investments]);

  return (
    <div className="portfolio-charts">
      <Reveal delay={90} className="allocation-reveal"><section className="chart-panel allocation-panel" aria-label="Portfolio allocation by category">
        <div className="chart-heading"><div><span className="eyebrow">WHERE IDEAS MEET</span><h2>Portfolio allocation</h2></div><span className="chart-corner-icon" aria-hidden="true"><ArrowUpRight size={19} /></span></div>
        <p className="chart-subtitle">A little perspective on the bigger picture.</p>
        <div className="allocation-chart-wrap" aria-hidden="true"><ResponsiveContainer width="100%" height={240} minWidth={0}><PieChart accessibilityLayer={false}><Pie rootTabIndex={-1} data={categories} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={108} paddingAngle={categories.length > 1 ? 4 : 0} cornerRadius={5} stroke="none" isAnimationActive={false}>{categories.map((entry, index) => <Cell key={entry.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip content={<ChartTooltip />} /></PieChart></ResponsiveContainer><div className="allocation-center"><span>Total simulated</span><strong>{money(total, true)}</strong><small>{categories.length} {categories.length === 1 ? 'category' : 'categories'}</small></div></div>
        <ul className="allocation-legend">{categories.map((item, index) => <li key={item.name}><span><i style={{ background: colors[index % colors.length] }} />{item.name}</span><strong>{percent(total ? item.value / total * 100 : 0)}</strong><span className="sr-only">, {money(item.value)} simulated</span></li>)}</ul>
      </section></Reveal>
      <Reveal delay={150} className="outlook-reveal"><section className="chart-panel outlook-panel" aria-label="Investment outlook by project">
        <div className="chart-heading"><div><span className="eyebrow">A LOOK AT WHAT COULD BE</span><h2>Investment outlook</h2></div><span className="badge">Estimated</span></div>
        <p className="chart-subtitle">Your simulations, side by side.</p>
        <div className="bar-chart-legend"><span><i />Simulated amount</span><span><i />Estimated value</span></div>
        <div className="outlook-chart-wrap" style={{ height: Math.max(220, projects.length * 63 + 20) }} aria-hidden="true"><ResponsiveContainer width="100%" height="100%" minWidth={0}><BarChart accessibilityLayer={false} data={projects} layout="vertical" margin={{ top: 5, right: 12, left: 0, bottom: 5 }} barGap={4} barCategoryGap="25%"><CartesianGrid stroke="#e8ede8" strokeDasharray="3 5" horizontal={false} /><XAxis type="number" axisLine={false} tickLine={false} tickFormatter={(value) => money(value, true)} tick={{ fill: '#69756e', fontSize: 11 }} minTickGap={25} /><YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={112} tick={{ fill: '#46564d', fontSize: 11 }} tickFormatter={(value) => value.length > 17 ? `${value.slice(0, 15)}…` : value} /><Tooltip content={<ChartTooltip />} cursor={{ fill: '#f4f7f3' }} /><Bar dataKey="invested" name="Simulated amount" fill="#c8d7cb" radius={[0, 3, 3, 0]} maxBarSize={15} isAnimationActive={false} /><Bar dataKey="estimated" name="Estimated value" fill="#164d3b" radius={[0, 3, 3, 0]} maxBarSize={15} isAnimationActive={false} /></BarChart></ResponsiveContainer></div>
        <div className="sr-only chart-data-accessible"><table><caption>Simulated amount and estimated total value by project</caption><thead><tr><th scope="col">Project</th><th scope="col">Simulated amount</th><th scope="col">Estimated value</th></tr></thead><tbody>{projects.map((project) => <tr key={project.id}><th scope="row">{project.fullName}</th><td>{money(project.invested)}</td><td>{money(project.estimated)}</td></tr>)}</tbody></table></div>
        <p className="chart-footnote">Simulation estimate — not a guaranteed return. Values reflect each saved simulation's original expected return.</p>
      </section></Reveal>
    </div>
  );
}
