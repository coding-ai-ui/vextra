import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import ProjectCard from '../Components/ProjectCard';
import { ErrorState, Reveal } from '../Components/ui';
import { AccountHeader, AccountNav, AccountSkeleton, CollectionEmpty, asList, useAccountData } from '../Components/AccountComponents';

export default function Following() {
  const { data, loading, error, reload } = useAccountData({ projects: '/community/following/' });
  const projects = asList(data?.projects);
  return <div className="container account-page"><AccountHeader eyebrow="STAY CLOSE TO WHAT MATTERS" title={<>Watch ideas <span className="serif-emphasis">unfold.</span></>} description="The projects you follow, together in one place. Their next chapter can become part of yours." action={<Link to="/notifications" className="btn btn-secondary"><Bell size={17} />Your updates</Link>} /><AccountNav />{loading ? <AccountSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : projects.length ? <><div className="account-collection-note"><span>{projects.length} followed {projects.length === 1 ? 'project' : 'projects'}</span><Link to="/settings">Manage notification preferences</Link></div><div className="project-grid">{projects.map((project, index) => <Reveal key={project.id} delay={Math.min(index, 3) * 45}><ProjectCard project={project} /></Reveal>)}</div></> : <CollectionEmpty following />}</div>;
}
