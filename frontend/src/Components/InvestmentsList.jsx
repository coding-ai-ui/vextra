import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { RiskBadge, Reveal } from './ui';
import { money, percent, date } from '../utils/formatters';

export default function InvestmentsList({ investments }) {
  return (
    <Reveal className="investments-reveal"><section className="investments-section" aria-labelledby="investments-heading">
      <div className="investments-section-heading"><div><div className="eyebrow">EVERY IDEA HAS A PLACE</div><h2 id="investments-heading">Your simulations<span className="investment-count">{investments.length}</span></h2></div><Link to="/projects" className="text-link">Find your next idea <ArrowUpRight size={16} /></Link></div>
      <div className="investments-table-wrap"><table className="investments-table"><thead><tr><th scope="col">Project</th><th scope="col">Simulated amount</th><th scope="col">Expected return</th><th scope="col">Expected profit</th><th scope="col">Risk</th><th scope="col">Added</th><th scope="col"><span className="sr-only">View project</span></th></tr></thead><tbody>{investments.map((investment, index) => <tr key={investment.id} style={{ '--investment-delay': `${Math.min(index, 3) * 70}ms` }}>
        <td className="investment-project-cell"><span className={`investment-project-monogram category-${String(investment.project.category).toLowerCase().replace(/\s+/g, '-')}`} aria-hidden="true">{investment.project.title.slice(0, 1)}</span><div><Link to={`/projects/${investment.project.id}`}>{investment.project.title}</Link><span>{investment.project.category}</span></div></td>
        <td data-label="Simulated amount"><strong>{money(investment.amount)}</strong></td>
        <td data-label="Expected return">{percent(investment.expected_return_snapshot)}</td>
        <td data-label="Expected profit" className="investment-profit">+{money(investment.expected_profit)}</td>
        <td data-label="Risk"><RiskBadge risk={investment.project.risk_level} /></td>
        <td data-label="Added" className="investment-date">{date(investment.created_at)}</td>
        <td className="investment-row-arrow"><Link to={`/projects/${investment.project.id}`} aria-label={`Explore ${investment.project.title}`}><ArrowUpRight size={18} /></Link></td>
      </tr>)}</tbody></table></div>
      <p className="investments-list-note">Each row is a saved simulation. Repeated projects are combined in your charts.</p>
    </section></Reveal>
  );
}
