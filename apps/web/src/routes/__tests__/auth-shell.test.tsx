import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { saveSession } from '../../app/auth-store.js';
import { routes } from '../../app/router.js';

describe('app shell', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('redirects unauthenticated visitors to the login page', async () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/'],
    });

    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('button', { name: '登录' })).toBeInTheDocument();
    expect(screen.getByLabelText('账号')).toBeInTheDocument();
  });

  it('renders top navigation and current account for authenticated pages', async () => {
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

    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '数据管理' })).toBeInTheDocument();
    expect(await screen.findByText('admin')).toBeInTheDocument();
  });
});
