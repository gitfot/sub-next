import { NavLink, Outlet } from 'react-router-dom';

export function DataPage() {
  return (
    <div className="panel data-page-panel">
      <nav className="tabs-left">
        <NavLink to="/data/node-links">节点链接</NavLink>
        <NavLink to="/data/preferred-addresses">优选地址</NavLink>
        <NavLink to="/data/subscriptions">订阅管理</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
