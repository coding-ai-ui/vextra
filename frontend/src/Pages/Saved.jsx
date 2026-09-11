import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import ProjectCard from '../Components/ProjectCard';
import { ErrorState, Reveal } from '../Components/ui';
import { AccountHeader, AccountNav, AccountSkeleton, CollectionEmpty, asList, useAccountData } from '../Components/AccountComponents';

export default function Saved() {
  const { data, loading, error, reload } = useAccountData({ projects: '/community/saved/' });
  const projects = asList(data?.projects);
  return <div className="container account-page"><AccountHeader eyebrow="A COLLECTION OF POSSIBILITIES" title={<>Ideas worth <span className="serif-emphasis">keeping.</span></>} description="Your saved projects. A quiet place to revisit the ideas that caught your attention." action={<Link to="/projects" className="btn btn-secondary">Explore projects<ArrowUpRight size={17} /></Link>} /><AccountNav />{loading ? <AccountSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : projects.length ? <><p className="account-result-count">{projects.length} saved {projects.length === 1 ? 'project' : 'projects'}</p><div className="project-grid">{projects.map((project, index) => <Reveal key={project.id} delay={Math.min(index, 3) * 45}><ProjectCard project={project} /></Reveal>)}</div></> : <CollectionEmpty />}</div>;
}
