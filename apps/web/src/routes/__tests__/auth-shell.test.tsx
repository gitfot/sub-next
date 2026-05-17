import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiJson } from '../../app/api-client.js';
import { saveSession } from '../../app/auth-store.js';
import { routes } from '../../app/router.js';

describe('app shell', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('redirects unauthenticated visitors to the login page', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('账号')).toBeInTheDocument();
  });

  it('renders a compact account menu for authenticated pages', async () => {
    saveSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        username: 'admin',
        email: 'admin@local.test',
      },
    });

    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    const user = userEvent.setup();

    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '数据管理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开账户菜单' })).toBeInTheDocument();
    expect(screen.queryByText('admin')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '退出登录' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '打开账户菜单' }));

    expect(await screen.findByText('admin')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
  });

  it('redirects /data to the first data tab and marks it active', async () => {
    saveSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        username: 'admin',
        email: 'admin@local.test',
      },
    });

    vi.spyOn(global, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      items: [],
    })));

    const router = createMemoryRouter(routes, {
      initialEntries: ['/data'],
    });

    render(<RouterProvider router={router} />);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/data/node-links');
    });

    const activeLink = screen.getByRole('link', { name: '节点链接' });
    expect(activeLink).toHaveClass('active');
  });

  it('clears the session and returns to login after a 401 api response', async () => {
    saveSession({
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
      user: {
        username: 'admin',
        email: 'admin@local.test',
      },
    });

    vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ message: 'Unauthorized' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    await expect(apiJson('/api/subscriptions')).rejects.toThrow('Unauthorized');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
    });
    expect(localStorage.getItem('sub-next-auth')).toBeNull();
  });
});
