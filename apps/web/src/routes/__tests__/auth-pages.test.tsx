import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../login-page.js';
import { RegisterPage } from '../register-page.js';

describe('auth pages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the backend rate-limit message on the login page', async () => {
    const user = userEvent.setup();

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Rate limit exceeded, retry in 32 seconds' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    );

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('账号'), 'demo@example.com');
    await user.type(screen.getByLabelText('密码'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: '登录' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('请求过于频繁，请 32 秒后再试');
  });

  it('shows the backend rate-limit message on the register page', async () => {
    const user = userEvent.setup();

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Rate limit exceeded, retry in 18 seconds' }), {
        status: 429,
        headers: { 'content-type': 'application/json' },
      }),
    );

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('邮箱'), 'demo@example.com');
    await user.type(screen.getByLabelText('用户名'), 'demo_user');
    await user.type(screen.getByLabelText('密码'), 'strong-password');
    await user.click(screen.getByRole('button', { name: '注册' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('请求过于频繁，请 18 秒后再试');
  });
});
