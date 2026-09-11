import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Brand } from './Navbar';
export default function Footer() {
  const groups = { Explore: [['Projects','/projects'],['How it works','/how-it-works'],['Compare','/compare']], Company: [['About','/about'],['Contact','/contact']], Resources: [['FAQ','/faq'],['Feedback','/feedback']], Account: [['Dashboard','/dashboard'],['Portfolio','/portfolio'],['Saved projects','/saved']], Legal: [['Privacy','/privacy'],['Terms','/terms']] };
  return <footer className="site-footer"><div className="container"><div className="footer-top"><div className="footer-brand"><Brand/><p>Invest in what matters.<br/>Begin with a little curiosity.</p><Link to="/projects" className="text-link">Find your next possibility <ArrowUpRight size={15}/></Link></div><div className="footer-links">{Object.entries(groups).map(([label, links]) => <div key={label}><span className="eyebrow">{label}</span>{links.map(([title, href]) => <Link key={href} to={href}>{title}</Link>)}</div>)}</div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Vestra. Invest in what matters.</span><span>Educational investment simulation. No real money is invested.</span></div></div></footer>;
}
