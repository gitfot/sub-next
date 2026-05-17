import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saveSession } from '../app/auth-store.js';

export function LoginPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account, password }),
    });

    if (!response.ok) {
      setError('登录失败');
      return;
    }

    const payload = await response.json();
    saveSession({
      ...payload.tokens,
      user: payload.user,
    });
    navigate('/');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="logo">
          <span>SN</span> sub-next
        </Link>
        <div className="auth-title">欢迎回来</div>

        <form className="stack" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="account">账号</label>
            <input id="account" type="text" value={account} onChange={(event) => setAccount(event.target.value)} />
          </div>
          <div>
            <label htmlFor="password">密码</label>
            <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-lg">
            登录
          </button>
        </form>

        <div className="auth-footer">
          还没有账号？<Link to="/register">立即注册</Link>
        </div>
      </div>
    </div>
  );
}
