import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getResponseErrorMessage } from '../app/api-errors.js';
import { saveSession } from '../app/auth-store.js';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
      setError(await getResponseErrorMessage(response, '注册失败'));
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
          <span>CS</span> CloudflareSub Next
        </Link>
        <div className="auth-title">创建账号</div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">邮箱 <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input id="email" type="email" placeholder="your@email.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div>
            <label htmlFor="username">用户名</label>
            <input id="username" type="text" placeholder="可选，用于快速登录" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </div>
          <div>
            <label htmlFor="register-password">密码 <span style={{ color: 'var(--danger)' }}>*</span></label>
            <input
              id="register-password"
              type="password"
              placeholder="至少 8 位字符"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>
          {error ? <p role="alert">{error}</p> : null}
          <button type="submit" className="btn btn-primary btn-lg">
            注册
          </button>
        </form>

        <div className="auth-footer">
          已有账号？<Link to="/login">直接登录</Link>
        </div>
      </div>
    </div>
  );
}
