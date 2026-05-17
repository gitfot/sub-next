import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { saveSession } from '../app/auth-store.js';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '' });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!response.ok) {
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
        <div className="auth-title">创建账号</div>

        <form className="stack" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email">邮箱</label>
            <input id="email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </div>
          <div>
            <label htmlFor="username">用户名</label>
            <input id="username" type="text" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </div>
          <div>
            <label htmlFor="register-password">密码</label>
            <input
              id="register-password"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
          </div>
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
