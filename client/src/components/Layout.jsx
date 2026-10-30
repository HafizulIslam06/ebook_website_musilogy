import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { SITE_NAME, whatsappUrl } from '../site.js';
import { Spinner } from './ui.jsx';

const NAV_LINKS = [
  { to: '/#inside', label: "What's Inside" },
  { to: '/#preview', label: 'Preview' },
  { to: '/#faq', label: 'FAQ' },
];
const QUICK_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/#faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact Us' },
];
const LEGAL_LINKS = [
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/terms', label: 'Terms & Conditions' },
  { to: '/refund', label: 'Refund Policy' },
];
const NO_SETTINGS = { tagline: '', payment_methods: [] };

// The "o" of the wordmark is the logo's wooden play button.
function Brand({ gradientId }) {
  return (
    <Link to="/" className="brand" aria-label={SITE_NAME}>
      <span aria-hidden="true">
        Musil
        <svg className="brand-o" viewBox="0 0 100 100">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e0a44a" />
              <stop offset="1" stopColor="#a86d24" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="50" fill={`url(#${gradientId})`} />
          <path
            d="M39 32v36l29-18z"
            fill="#fff"
            stroke="#fff"
            strokeWidth="6"
            strokeLinejoin="round"
          />
        </svg>
        gy
      </span>
    </Link>
  );
}

function Header({ pathname }) {
  const [open, setOpen] = useState(false);
  const canBuy = pathname !== '/checkout' && !pathname.startsWith('/order/');

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Brand gradientId="brand-wood-header" />
        <nav id="site-nav" className={open ? 'site-nav open' : 'site-nav'} aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link key={link.to} to={link.to} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
        </nav>
        {canBuy && (
          <Link to="/checkout" className="btn btn-primary btn-small">
            Buy Now
          </Link>
        )}
        <button
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls="site-nav"
          onClick={() => setOpen(!open)}
        >
          <span className="sr-only">Menu</span>
          <span className="menu-icon" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

function FooterLinks({ title, children }) {
  return (
    <section>
      <h2>{title}</h2>
      <ul>{children}</ul>
    </section>
  );
}

function Footer({ settings }) {
  const { tagline, whatsapp, support_email: email, payment_methods: methods } = settings;

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <Brand gradientId="brand-wood-footer" />
          {tagline && <p>{tagline}</p>}
        </div>

        <FooterLinks title="Quick Links">
          {QUICK_LINKS.map((link) => (
            <li key={link.to}>
              <Link to={link.to}>{link.label}</Link>
            </li>
          ))}
        </FooterLinks>

        {(whatsapp || email) && (
          <FooterLinks title="Support">
            {whatsapp && (
              <li>
                <a
                  href={whatsappUrl(`Hello ${SITE_NAME}`, whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                >
                  WhatsApp
                </a>
              </li>
            )}
            {email && (
              <li>
                <a href={`mailto:${email}`}>Email</a>
              </li>
            )}
          </FooterLinks>
        )}

        {methods.length > 0 && (
          <FooterLinks title="Payment Methods">
            {methods.map((method) => (
              <li key={method}>{method}</li>
            ))}
          </FooterLinks>
        )}

        <div className="footer-bottom">
          <p>
            © {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
          </p>
          <ul>
            {LEGAL_LINKS.map((link) => (
              <li key={link.to}>
                <Link to={link.to}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname, hash } = useLocation();
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    api('/settings').then(setSettings).catch(() => setSettings(NO_SETTINGS));
  }, []);

  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
  }, [pathname, hash]);

  return (
    <div className="site">
      <Header pathname={pathname} />
      {settings ? <Outlet context={settings} /> : <Spinner />}
      <Footer settings={settings ?? NO_SETTINGS} />
    </div>
  );
}
