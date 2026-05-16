import { NavLink, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <>
      <header>
        <NavLink to="/" className="logo">
          <span>CS</span> CloudflareSub Next
        </NavLink>
        <nav>
          <NavLink to="/">首页</NavLink>
          <NavLink to="/data">数据管理</NavLink>
        </nav>
        <div className="user-area">
          <span className="text-small text-muted">demo@example.com</span>
          <div className="avatar">D</div>
        </div>
      </header>
      <main>
        <div className="main-single">
          <Outlet />
        </div>
      </main>
    </>
  );
}
