import { useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearSession, getSessionAccountLabel, listenForAuthExpired } from '../app/auth-store.js';

export function AppShell() {
  const navigate = useNavigate();
  const accountLabel = getSessionAccountLabel();
  const avatarLabel = accountLabel.slice(0, 1).toUpperCase();

  useEffect(() => {
    return listenForAuthExpired(() => {
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  function handleLogout() {
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header>
        <NavLink to="/" className="logo">
          <span>SN</span> sub-next
        </NavLink>
        <nav>
          <NavLink to="/">首页</NavLink>
          <NavLink to="/data">数据管理</NavLink>
        </nav>
        <div className="user-area">
          <span className="text-small text-muted">{accountLabel}</span>
          <button type="button" className="btn btn-secondary" onClick={handleLogout}>
            退出登录
          </button>
          <div className="avatar">{avatarLabel}</div>
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
