import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import { Spinner } from '../../components/ui.jsx';
import { SITE_NAME } from '../../site.js';

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/product', label: 'Product' },
  { to: '/admin/settings', label: 'Settings' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api('/admin/me')
      .then(() => setReady(true))
      .catch(() => navigate('/admin/login', { replace: true }));
  }, [navigate]);

  async function logout() {
    await api('/admin/logout', { method: 'POST' });
    navigate('/admin/login', { replace: true });
  }

  if (!ready) return <Spinner />;

  return (
    <div className="admin">
      <aside className="admin-side">
        <div className="admin-side-top">
          <span className="admin-brand">{SITE_NAME}</span>
          <button
            type="button"
            className="menu-button"
            aria-expanded={open}
            aria-controls="admin-nav"
            onClick={() => setOpen(!open)}
          >
            <span className="sr-only">Menu</span>
            <span className="menu-icon" aria-hidden="true" />
          </button>
        </div>
        <nav id="admin-nav" className={open ? 'admin-nav open' : 'admin-nav'} aria-label="Admin">
          {ADMIN_LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} onClick={() => setOpen(false)}>
              {link.label}
            </NavLink>
          ))}
          <button className="link-button" onClick={logout}>
            Sign out
          </button>
        </nav>
      </aside>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
