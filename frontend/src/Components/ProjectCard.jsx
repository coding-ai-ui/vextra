import { Link } from 'react-router-dom';
import { ArrowUpRight, Clock3 } from 'lucide-react';
import ProjectVisual from './ProjectVisual';
import { RiskBadge, ProgressBar } from './ui';
import { money, percent } from '../utils/formatters';
import { SaveButton, CompareButton } from './ProjectActions';

export default function ProjectCard({ project }) {
  const progress = Number(project.funding_goal) > 0 ? Number(project.current_funding) / Number(project.funding_goal) * 100 : 0;
  return (
    <article className="project-card">
      <Link to={`/projects/${project.slug || project.id}`} className="project-card-visual-link" tabIndex={-1} aria-hidden="true">
        {project.image ? <img className="project-card-image" src={project.image} alt="" loading="lazy" onError={event => { event.currentTarget.hidden = true; }}/>: null}
        <ProjectVisual category={project.category} title={project.title} className="project-card-visual" />
        <span className="project-visual-category">{project.category}</span>
        {project.featured && <span className="project-featured-badge">Featured</span>}
        <span className="project-visual-arrow"><ArrowUpRight size={21} /></span>
      </Link>
      <div className="project-card-body">
        <h3><Link to={`/projects/${project.slug || project.id}`}>{project.title}</Link></h3>
        <p className="project-card-description">{project.short_description}</p>
        <div className="project-card-metrics">
          <div><span className="project-return">{percent(project.expected_return)}<span>↗</span></span><span className="metric-label">Expected return</span></div>
          <div className="project-card-risk"><RiskBadge risk={project.risk_level} /><span className="project-duration"><Clock3 size={13} /> {project.duration} months</span></div>
        </div>
        <div className="project-funding">
          <div className="project-funding-caption"><strong>{money(project.current_funding, true)} <span>of {money(project.funding_goal, true)}</span></strong><span>{Math.round(progress)}% funded</span></div>
          <ProgressBar value={progress} />
        </div>
        {project.impact_area && <div className="card-impact"><span>{project.impact_area}</span><span title="Illustrative educational impact score">{project.impact_score}/100 impact</span></div>}
        <div className="project-card-footer"><Link className="project-card-link" to={`/projects/${project.slug || project.id}`}>View details <ArrowUpRight size={18} /></Link><div className="card-quick-actions"><SaveButton project={project} compact/><CompareButton project={project} compact/></div></div>
      </div>
    </article>
  );
}
