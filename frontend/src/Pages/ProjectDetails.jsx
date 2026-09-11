import { useEffect, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Clock3, ShieldCheck, Sprout, Info } from 'lucide-react';
import api, { errorMessage } from '../Services/api';
import ProjectVisual from '../Components/ProjectVisual';
import InvestmentSimulator from '../Components/InvestmentSimulator';
import { Reveal, RiskBadge, ProgressBar, LoadingState, ErrorState, EmptyState } from '../Components/ui';
import { money, percent } from '../utils/formatters';
import Dialog from '../Components/Dialog';
import ProjectActions from '../Components/ProjectActions';
import ProjectCard from '../Components/ProjectCard';
import Comments from '../Components/Comments';

export default function ProjectDetails() {
  const { slug, id: legacyId } = useParams();
  const id = slug || legacyId;
  const location = useLocation();
  const [simulating, setSimulating] = useState(location.hash === '#simulator');
  const [related, setRelated] = useState([]);
  const [result, setResult] = useState({ key: null, project: null, error: '', notFound: false });
  const [retry, setRetry] = useState(0);
  const requestKey = `${id}:${retry}`;
  const loading = result.key !== requestKey;
  const { project, error, notFound } = result;
  useEffect(() => {
    const controller = new AbortController();
    api.get(`/projects/${id}/`, { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, project: data, error: '', notFound: false });
          document.title = `${data.title} — Vestra`;
          api.get('/projects/', { params: { category: data.category }, signal: controller.signal }).then(({ data: items }) => { setRelated(items.filter(item => item.id !== data.id).sort((a, b) => ((b.tags || []).filter(tag => (data.tags || []).includes(tag)).length + (b.impact_area === data.impact_area ? 1 : 0)) - ((a.tags || []).filter(tag => (data.tags || []).includes(tag)).length + (a.impact_area === data.impact_area ? 1 : 0))).slice(0, 3)); }).catch(() => {});
        }
      })
      .catch((reason) => {
        if (!controller.signal.aborted) {
          setResult({ key: requestKey, project: null, notFound: reason.response?.status === 404, error: errorMessage(reason) });
        }
      });
    return () => controller.abort();
  }, [id, requestKey]);

  if (loading) return <div className="container detail-loading"><LoadingState cards={2} /></div>;
  if (notFound) return <div className="container detail-loading"><EmptyState title="This idea isn't on the map." action={<Link to="/projects" className="btn btn-primary">Explore projects <ArrowUpRight size={17} /></Link>}>The project may have moved or is no longer available. There's more to discover.</EmptyState></div>;
  if (error) return <div className="container detail-loading"><ErrorState message={error} onRetry={() => setRetry((value) => value + 1)} /></div>;
  if (!project) return null;
  const progress = Number(project.funding_goal) > 0 ? Number(project.current_funding) / Number(project.funding_goal) * 100 : 0;

  return (
    <div className="container project-detail-page">
      <nav className="project-breadcrumb" aria-label="Breadcrumb"><Link to="/projects"><ArrowLeft size={16} /> All projects</Link><span>/</span><span aria-current="page">{project.title}</span></nav>
      <div className="project-detail-layout">
        <div className="project-detail-main">
          <Reveal><div className="detail-category-row"><span className="eyebrow">{project.category}</span><span className="detail-fictional">Fictional project</span></div><h1 className="page-heading">{project.title}<span className="title-period">.</span></h1><p className="project-thesis">{project.short_description}</p></Reveal>
          <div className="project-organization"><span>{project.organization || 'Independent project'}</span><span>{project.location || 'Location not specified'}</span><span className="badge">{project.status || 'active'}</span></div>
          <ProjectActions project={project}/>
          <Reveal delay={75}><div className="detail-project-visual"><ProjectVisual category={project.category} title={project.title} /><span className="detail-visual-caption"><span>THE NEXT CHAPTER STARTS WITH AN IDEA</span><span>VESTRA / {String(project.id).padStart(3, '0')}</span></span></div></Reveal>
          <Reveal><div className="detail-key-metrics">
            <div><span className="metric-label">Expected return</span><strong className="detail-return">{percent(project.expected_return)} <ArrowUpRight size={21} /></strong></div>
            <div><span className="metric-label">Risk level</span><RiskBadge risk={project.risk_level} /></div>
            <div><span className="metric-label">Project duration</span><strong>{project.duration}<small> months</small></strong></div>
          </div></Reveal>
          {project.image && <img className="detail-hero-image" src={project.image} alt={`${project.title} project`} onError={event => { event.currentTarget.hidden = true; }}/>}
          <button onClick={() => setSimulating(true)} className="btn btn-primary detail-mobile-simulate">Simulate investment <ArrowUpRight size={17} /></button>
          <Reveal><section className="project-narrative"><div className="eyebrow">THE IDEA</div><h2>Possibility, with purpose.</h2>{String(project.description || project.short_description).split(/\n\s*\n/).map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section></Reveal>
          {(project.objective || project.impact) && <Reveal><section className="project-objectives">{project.objective && <div><span className="eyebrow">THE OBJECTIVE</span><p>{project.objective}</p></div>}{project.impact && <div><span className="eyebrow">THE POTENTIAL IMPACT</span><p>{project.impact}</p></div>}</section></Reveal>}
          <Reveal><section className="impact-overview"><div><p className="eyebrow">A LENS ON IMPACT</p><h2>{project.impact_area || project.category}</h2><p>An illustrative score for comparing the potential reach of fictional projects. It is an educational measure, not an independently verified rating.</p></div><div className="impact-score-orbit" style={{ '--score': `${project.impact_score || 0}%` }}><strong>{project.impact_score || 0}<small>/100</small></strong><span>Impact score</span></div></section><div className="project-tags">{(project.tags || []).map(tag => <Link key={tag} to={`/projects?search=${encodeURIComponent(tag)}`}>{tag}</Link>)}</div>{project.sustainability?.length > 0 && <ul className="sustainability-list">{project.sustainability.map(item => <li key={item}><Sprout size={15}/>{item}</li>)}</ul>}</Reveal>
          {project.gallery?.length > 0 && <section className="project-gallery" aria-label="Project gallery">{project.gallery.map((image, index) => <a key={image} href={image} target="_blank" rel="noopener noreferrer"><img src={image} alt={`${project.title}, gallery image ${index + 1}`} loading="lazy" onError={event => { event.currentTarget.parentElement.hidden = true; }}/></a>)}</section>}
          <Reveal><section className="detail-funding-section"><div className="detail-section-heading"><h2>A shared ambition.</h2><span className="badge">Simulated funding</span></div><p className="muted">A fictional snapshot of this project's funding progress.</p><div className="detail-funding-values"><strong>{money(project.current_funding)}</strong><span>of {money(project.funding_goal)} goal</span><b>{Math.round(progress)}%</b></div><ProgressBar value={progress} /><div className="detail-funding-note"><Sprout size={16} /><span>Your simulation explores a potential outcome. It does not transfer funds or change this fictional funding total.</span></div></section></Reveal>
          <Reveal><section className="detail-explainer"><div><ShieldCheck size={21} /><h3>Understand the risk</h3><p>Risk describes uncertainty in a fictional project's outcome. A higher estimated return can involve greater uncertainty.</p></div><div><Clock3 size={21} /><h3>Keep time in view</h3><p>The {project.duration}-month duration sets the project's simulation horizon. Expected return applies to the full period and is not annualized.</p></div></section></Reveal>
          <div className="detail-education-note"><Info size={17} /><p>All projects, funding values and outcomes are fictional. For educational demonstration only. Simulation estimate — not a guaranteed return.</p></div>
        </div>
        <aside className="project-simulator-sidebar" aria-label="Investment simulator"><div className="simulation-invitation"><p className="eyebrow">MAKE ROOM FOR WHAT IF.</p><h2>An idea.<br/><span className="serif-emphasis">Your perspective.</span></h2><p>Explore what an allocation to {project.title} could look like in your fictional portfolio.</p><div className="invitation-return"><strong>{percent(project.expected_return)}</strong><span>Illustrative return<br/>over {project.duration} months</span></div><button className="btn btn-primary" onClick={() => setSimulating(true)}>Simulate investment <ArrowUpRight size={17}/></button><small>Simulation only — no real money is being invested.</small></div><div className="simulator-sidebar-note"><span className="sidebar-note-line" /><p>A little curiosity.<br />A clearer perspective.</p></div></aside>
      </div>
      <Comments project={project}/>
      {related.length > 0 && <section className="related-projects"><Reveal className="section-heading"><div><p className="eyebrow">CONNECTED BY PURPOSE</p><h2>You may also be <span className="serif-emphasis">interested in.</span></h2></div><Link className="text-link" to={`/projects?category=${encodeURIComponent(project.category)}`}>Explore {project.category} <ArrowUpRight size={17}/></Link></Reveal><div className="project-grid">{related.map(item => <ProjectCard key={item.id} project={item}/>)}</div></section>}
      <Dialog open={simulating} onClose={() => setSimulating(false)} title="Simulate an allocation" description={project.title} className="simulation-dialog"><InvestmentSimulator key={project.id} project={project}/></Dialog>
    </div>
  );
}
