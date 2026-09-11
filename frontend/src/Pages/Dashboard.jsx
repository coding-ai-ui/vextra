import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ErrorState, Reveal } from '../Components/ui';
import PortfolioCharts from '../Components/PortfolioCharts';
import ProjectCard from '../Components/ProjectCard';
import { AccountNav, AccountPanel, AccountSkeleton, ActivityList, CompactProjects, PortfolioEmpty, PortfolioSummary, asList, useAccountData } from '../Components/AccountComponents';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAccountData({ investments: '/investments/', saved: '/community/saved/', following: '/community/following/', activity: '/community/activity/', projects: '/projects/' });
  const investments = useMemo(() => asList(data?.investments), [data]);
  const saved = useMemo(() => asList(data?.saved), [data]);
  const following = useMemo(() => asList(data?.following), [data]);
  const suggestions = useMemo(() => {
    const categories = new Set([...(user?.interests || []), ...saved.map((project) => project.category), ...following.map((project) => project.category), ...investments.map((investment) => investment.project.category)]);
    const known = new Set([...saved, ...following, ...investments.map((investment) => investment.project)].map((project) => project.id));
    return asList(data?.projects).filter((project) => !known.has(project.id)).sort((a, b) => Number(categories.has(b.category)) - Number(categories.has(a.category)) || Number(b.impact_score || 0) - Number(a.impact_score || 0) || a.title.localeCompare(b.title)).slice(0, 3);
  }, [data, user?.interests, saved, following, investments]);
  const firstName = String(user?.first_name || user?.username || 'explorer').split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return <div className="container dashboard-page account-page">
    <Reveal><header className="dashboard-header"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR VESTRA WORKSPACE</div><h1>{greeting},<br className="dashboard-mobile-break" /> <span className="serif-emphasis">{firstName}.</span></h1><p>Your ideas, your conversations, your next possibility.</p></div><Link to="/projects" className="btn btn-primary"><Plus size={16} />Explore projects</Link></header></Reveal><AccountNav />
    {loading ? <AccountSkeleton /> : error ? <ErrorState message={error} onRetry={reload} /> : <>
      <div className="account-section-heading"><div><span className="eyebrow">YOUR LEARNING, TAKING SHAPE</span><h2>Your simulated portfolio</h2></div><Link to="/portfolio" className="text-link">Manage portfolio<ArrowUpRight size={17} /></Link></div>
      {investments.length ? <><PortfolioSummary investments={investments} /><PortfolioCharts investments={investments} /></> : <PortfolioEmpty />}
      <div className="account-two-columns"><Reveal><AccountPanel title="Ideas you've saved" eyebrow="A LITTLE COLLECTION" to="/saved"><CompactProjects projects={saved} emptyTitle="Keep an idea for later." emptyMessage="Bookmark a project and it will be waiting here when you're ready." /></AccountPanel></Reveal><Reveal delay={70}><AccountPanel title="Projects you follow" eyebrow="STAY IN THE CONVERSATION" to="/following"><CompactProjects projects={following} emptyTitle="Follow a little progress." emptyMessage="Follow a project to hear about its updates and milestones." /></AccountPanel></Reveal></div>
      <Reveal><AccountPanel title="Your recent activity" eyebrow="SMALL STEPS, A BIGGER PICTURE" to="/profile" linkLabel="Your profile"><ActivityList activities={asList(data?.activity)} limit={5} /></AccountPanel></Reveal>
      {suggestions.length > 0 && <section className="account-suggestions"><Reveal><div className="account-section-heading"><div><span className="eyebrow">CONTINUE EXPLORING</span><h2>Another idea to <span className="serif-emphasis">consider.</span></h2><p>Inspired by your interests and the projects you explore, with impact as a starting point.</p></div><Link to="/projects" className="text-link">All projects<ArrowUpRight size={17} /></Link></div></Reveal><div className="project-grid">{suggestions.map((project, index) => <Reveal key={project.id} delay={index * 55}><ProjectCard project={project} /></Reveal>)}</div></section>}
    </>}
  </div>;
}

