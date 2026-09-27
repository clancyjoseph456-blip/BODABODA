import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { roleLabel } from '../services/format';

/**
 * DashboardShell — the chrome every signed-in page renders inside.
 * The nav items are derived from role so a rider never sees admin-only links.
 */
export default function DashboardShell({ title, subtitle, actions, children }) {
  const { user, signOut, isAdmin, isOwner } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const links = [
    { to: '/app', label: 'Overview', show: true, end: true },
    { to: '/app/riders', label: isRiderOnly(user) ? 'My Bike' : 'Riders', show: true },
    { to: '/app/analytics', label: 'Analytics', show: true },
    { to: '/app/users', label: 'Users', show: isAdmin },
    { to: '/app/audit', label: 'Audit Log', show: isAdmin || isOwner }
  ].filter((link) => link.show);

  return (
    <div className="app-shell d-flex">
      <aside className={`app-sidebar ${collapsed ? 'is-collapsed' : ''}`}>
        <Link to="/app" className="brand d-flex align-items-center gap-2 text-decoration-none">
          <span className="brand-mark" aria-hidden="true">🏍️</span>
          {!collapsed ? <span className="brand-text">Boda Manager</span> : null}
        </Link>

        <nav className="app-nav">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `app-nav-link ${isActive ? 'is-active' : ''}`}
              title={link.label}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {collapsed ? '»' : '«'}
        </button>
      </aside>

      <div className="app-main flex-grow-1">
        <header className="app-topbar d-flex justify-content-between align-items-center gap-3">
          <div>
            <h1 className="h4 mb-0">{title}</h1>
            {subtitle ? <p className="text-muted small mb-0">{subtitle}</p> : null}
          </div>

          <div className="d-flex align-items-center gap-3">
            {actions}
            <div className="text-end">
              <p className="mb-0 fw-semibold small">{user?.full_name}</p>
              <p className="mb-0 text-muted small">{roleLabel(user?.role)}</p>
            </div>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

function isRiderOnly(user) {
  return user?.role === 'rider';
}
