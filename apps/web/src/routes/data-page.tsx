import { NavLink, Outlet } from 'react-router-dom';

function NodeLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13" />
      <path d="M14 11a5 5 0 0 1 0 7l-1.5 1.5a5 5 0 0 1-7-7L7 11" />
      <path d="M8.5 12h7" />
    </svg>
  );
}

function PreferredAddressIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 21s6-4.8 6-11a6 6 0 1 0-12 0c0 6.2 6 11 6 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function SubscriptionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4.5h10a2 2 0 0 1 2 2V20l-7-4-7 4V6.5a2 2 0 0 1 2-2Z" />
      <path d="M9.5 9.5h5" />
    </svg>
  );
}

export function DataPage() {
  return (
    <div className="panel data-page-panel">
      <nav className="tabs-left">
        <NavLink to="/data/node-links">
          <span className="tab-icon"><NodeLinkIcon /></span>
          <span>节点链接</span>
        </NavLink>
        <NavLink to="/data/preferred-addresses">
          <span className="tab-icon"><PreferredAddressIcon /></span>
          <span>优选地址</span>
        </NavLink>
        <NavLink to="/data/subscriptions">
          <span className="tab-icon"><SubscriptionIcon /></span>
          <span>订阅管理</span>
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
