import { Component, Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Outlet, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProductProvider } from './context/ProductContext';
import Navbar from './Components/Navbar';
import Footer from './Components/Footer';
import ProtectedRoute, { AdminRoute } from './Components/ProtectedRoute';
import AdminLayout from './Components/AdminLayout';
import { LoadingState } from './Components/ui';
import Home from './Pages/Home';
const Projects = lazy(() => import('./Pages/Projects'));
const ProjectDetails = lazy(() => import('./Pages/ProjectDetails'));
const Dashboard = lazy(() => import('./Pages/Dashboard'));
const Portfolio = lazy(() => import('./Pages/Portfolio'));
const Saved = lazy(() => import('./Pages/Saved'));
const Following = lazy(() => import('./Pages/Following'));
const Notifications = lazy(() => import('./Pages/Notifications'));
const Profile = lazy(() => import('./Pages/Profile'));
const Settings = lazy(() => import('./Pages/Settings'));
const PasswordReset = lazy(() => import('./Pages/PasswordReset'));
const Compare = lazy(() => import('./Pages/Compare'));
const Learn = lazy(() => import('./Pages/Learn'));
const Contact = lazy(() => import('./Pages/Contact'));
const Legal = lazy(() => import('./Pages/Legal'));
const Login = lazy(() => import('./Pages/Login'));
const Register = lazy(() => import('./Pages/Register'));
const NotFound = lazy(() => import('./Pages/NotFound'));
const About = lazy(() => import('./Pages/About'));
const AdminLogin = lazy(() => import('./Pages/AdminLogin'));
const AdminDashboard = lazy(() => import('./Pages/AdminDashboard'));
const AdminProjects = lazy(() => import('./Pages/AdminProjects'));
const AdminProjectForm = lazy(() => import('./Pages/AdminProjectForm'));
const AdminUsers = lazy(() => import('./Pages/AdminUsers'));
const AdminUserForm = lazy(() => import('./Pages/AdminUserForm'));
const AdminUserDetails = lazy(() => import('./Pages/AdminUserDetails'));
const AdminComments = lazy(() => import('./Pages/AdminComments'));
const AdminFeedback = lazy(() => import('./Pages/AdminFeedback'));
const titles = { '/': 'Invest in what matters.', '/projects': 'Explore projects', '/dashboard': 'Your dashboard', '/portfolio':'Your simulated portfolio', '/saved':'Saved projects', '/following':'Projects you follow', '/notifications':'Notifications', '/profile':'Your profile', '/settings':'Settings', '/compare':'Compare possibilities', '/how-it-works':'How it works', '/faq':'Thoughtful answers', '/contact':'Get in touch', '/feedback':'Share your feedback', '/privacy':'Your data', '/terms':'Our shared space', '/forgot-password':'Reset your password', '/reset-password':'A fresh start', '/login': 'Welcome back', '/register': 'Start exploring', '/about': 'About Vestra', '/403':'Access restricted' };
function AppLayout() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    document.title = `${titles[pathname] || (pathname.startsWith('/projects/') ? 'Project overview' : 'Page not found')} | Vestra`;
    if (!hash) { window.scrollTo({ top: 0, behavior: 'instant' }); document.getElementById('main-content')?.focus({ preventScroll: true }); return; }
    const scrollToTarget = () => { const target = document.getElementById(hash.slice(1)); if (!target) return false; target.scrollIntoView({ block: 'start', behavior: 'instant' }); return true; };
    if (scrollToTarget()) return;
    const observer = new MutationObserver(() => { if (scrollToTarget()) observer.disconnect(); });
    const main = document.getElementById('main-content'); if (main) observer.observe(main, { childList: true, subtree: true });
    const timer = setTimeout(() => observer.disconnect(), 10000);
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [pathname, hash]);
  return <><a className="skip-link" href="#main-content">Skip to content</a><Navbar/><main id="main-content" tabIndex={-1}><div className="route-content" key={pathname}><Suspense fallback={<div className="container section"><LoadingState/></div>}><Outlet/></Suspense></div></main><Footer/></>;
}
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { if (this.state.failed) return <main className="container not-found"><p className="eyebrow">VESTRA / SOMETHING INTERRUPTED THE JOURNEY</p><h1>A fresh start.</h1><p>Something interrupted this page. Reload to continue exploring.</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Reload Vestra</button></main>; return this.props.children; }
}
function Forbidden() { return <section className="container not-found"><p className="eyebrow">A DIFFERENT KIND OF ACCESS / 403</p><h1>This space is reserved.</h1><p>Your account does not have permission to access the administration workspace.</p><div className="button-row"><Link to="/dashboard" className="btn btn-primary">Your dashboard</Link><Link to="/projects" className="btn btn-secondary">Explore projects</Link></div></section>; }
export default function App() {
  return <ErrorBoundary><BrowserRouter><AuthProvider><ToastProvider><ProductProvider><Suspense fallback={<div className="container section"><LoadingState/></div>}><Routes>
    <Route path="/admin/login" element={<AdminLogin/>}/>
    <Route element={<AdminRoute><AdminLayout/></AdminRoute>}>
      <Route path="/admin" element={<AdminDashboard/>}/><Route path="/admin/projects" element={<AdminProjects/>}/><Route path="/admin/projects/new" element={<AdminProjectForm/>}/><Route path="/admin/projects/:id/edit" element={<AdminProjectForm/>}/><Route path="/admin/users" element={<AdminUsers/>}/><Route path="/admin/users/new" element={<AdminUserForm/>}/><Route path="/admin/users/:id" element={<AdminUserDetails/>}/><Route path="/admin/users/:id/edit" element={<AdminUserForm/>}/><Route path="/admin/comments" element={<AdminComments/>}/><Route path="/admin/reports" element={<AdminComments/>}/><Route path="/admin/feedback" element={<AdminFeedback/>}/>
    </Route>
    <Route element={<AppLayout/>}>
      <Route index element={<Home/>}/><Route path="projects" element={<Projects/>}/><Route path="projects/:slug" element={<ProjectDetails/>}/><Route path="login" element={<Login/>}/><Route path="register" element={<Register/>}/><Route path="forgot-password" element={<PasswordReset/>}/><Route path="reset-password" element={<PasswordReset/>}/>
      <Route element={<ProtectedRoute/>}><Route path="dashboard" element={<Dashboard/>}/><Route path="portfolio" element={<Portfolio/>}/><Route path="saved" element={<Saved/>}/><Route path="following" element={<Following/>}/><Route path="notifications" element={<Notifications/>}/><Route path="profile" element={<Profile/>}/><Route path="settings" element={<Settings/>}/></Route>
      <Route path="compare" element={<Compare/>}/><Route path="about" element={<About/>}/><Route path="how-it-works" element={<Learn/>}/><Route path="faq" element={<Learn/>}/><Route path="contact" element={<Contact/>}/><Route path="feedback" element={<Contact/>}/><Route path="privacy" element={<Legal/>}/><Route path="terms" element={<Legal/>}/><Route path="403" element={<Forbidden/>}/><Route path="*" element={<NotFound/>}/>
    </Route>
  </Routes></Suspense></ProductProvider></ToastProvider></AuthProvider></BrowserRouter></ErrorBoundary>;
}
