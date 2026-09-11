import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children = null }) {
  const { isAuthenticated, authLoading } = useAuth();
  const location = useLocation();
  if (authLoading) {
    return <div className="auth-loading container" aria-busy="true"><span className="auth-spinner" /><p>Opening your workspace…</p></div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: { pathname: location.pathname, search: location.search, hash: location.hash }, resumeState: location.state }} />;
  }
  return children || <Outlet />;
}

export function AdminRoute({ children }) {
  const { user, isAuthenticated, authLoading } = useAuth();
  const location = useLocation();
  if (authLoading) return <div className="auth-loading container" aria-busy="true"><span className="auth-spinner" /><p>Opening the admin workspace...</p></div>;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  if (user?.role !== 'admin') return <Navigate to="/403" replace />;
  return children || <Outlet />;
}
