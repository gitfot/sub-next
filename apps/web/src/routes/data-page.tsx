import { NavLink, Outlet } from 'react-router-dom';

export function DataPage() {
  return (
    <>
      <div className="tabs">
        <NavLink to="/data/node-links">节点链接</NavLink>
        <NavLink to="/data/preferred-addresses">优选地址</NavLink>
        <NavLink to="/data/subscriptions">订阅管理</NavLink>
      </div>
      <main>
        <div className="main-single">
          <Outlet />
        </div>
      </main>
    </>
  );
}
