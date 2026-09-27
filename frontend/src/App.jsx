import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import HomePage from './pages/public/HomePage';
import AuthPage from './pages/public/AuthPage';
import OverviewPage from './pages/dashboard/OverviewPage';
import RidersPage from './pages/dashboard/RidersPage';
import RiderDetailPage from './pages/dashboard/RiderDetailPage';
import AnalyticsPage from './pages/dashboard/AnalyticsPage';
import UsersPage from './pages/dashboard/UsersPage';
import { Loading } from './components/StatCard';

/** Gate for signed-in routes. Shows nothing while the session is revalidated. */
function RequireAuth({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) return <Loading label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  // Non-admins hitting an admin page get sent home rather than shown an error.
  if (adminOnly && !isAdmin) return <Navigate to="/app" replace />;

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/register" element={<AuthPage mode="register" />} />

      <Route
        path="/app"
        element={
          <RequireAuth>
            <OverviewPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/riders"
        element={
          <RequireAuth>
            <RidersPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/riders/:riderId"
        element={
          <RequireAuth>
            <RiderDetailPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/analytics"
        element={
          <RequireAuth>
            <AnalyticsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/app/users"
        element={
          <RequireAuth adminOnly>
            <UsersPage />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
