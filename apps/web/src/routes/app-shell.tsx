import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearSession, getSessionAccountLabel, listenForAuthExpired } from '../app/auth-store.js';

export function AppShell() {
  const navigate = useNavigate();
  const accountLabel = getSessionAccountLabel();
  const avatarLabel = accountLabel.slice(0, 1).toUpperCase();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return listenForAuthExpired(() => {
      navigate('/login', { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function handleLogout() {
    setIsAccountMenuOpen(false);
    clearSession();
    navigate('/login', { replace: true });
  }

  return (
    <>
      <header>
        <NavLink to="/" className="logo">
          <span>CS</span>Sub Next
        </NavLink>
        <nav>
          <NavLink to="/">首页</NavLink>
          <NavLink to="/data">数据管理</NavLink>
        </nav>
        <div className="user-area" ref={accountMenuRef}>
          <button
            type="button"
            className="avatar-trigger"
            aria-label="打开账户菜单"
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
            onClick={() => setIsAccountMenuOpen((current) => !current)}
          >
            <div className="avatar">{avatarLabel}</div>
          </button>
          {isAccountMenuOpen ? (
            <div className="account-popover" role="menu" aria-label="账户菜单">
              <div className="account-name">{accountLabel}</div>
              <button type="button" className="account-menu-item" role="menuitem" onClick={handleLogout}>
                退出登录
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
