import { Navigate, createBrowserRouter } from 'react-router-dom';
import { getSession } from './auth-store.js';
import { AppShell } from '../routes/app-shell.js';
import { DataPage } from '../routes/data-page.js';
import { HomePage } from '../routes/home-page.js';
import { LoginPage } from '../routes/login-page.js';
import { NodeLinkPage } from '../routes/node-link-page.js';
import { PreferredAddressPage } from '../routes/preferred-address-page.js';
import { RegisterPage } from '../routes/register-page.js';
import { SubscriptionManagementPage } from '../routes/subscription-management-page.js';

function RequireAuth() {
  if (!getSession()) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
}

function RedirectAuthenticated({ children }: { children: React.ReactNode }) {
  if (getSession()) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export const routes = [
  { path: '/login', element: <RedirectAuthenticated><LoginPage /></RedirectAuthenticated> },
  { path: '/register', element: <RedirectAuthenticated><RegisterPage /></RedirectAuthenticated> },
  {
    path: '/',
    element: <RequireAuth />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'data',
        element: <DataPage />,
        children: [
          { index: true, element: <NodeLinkPage /> },
          { path: 'node-links', element: <NodeLinkPage /> },
          { path: 'preferred-addresses', element: <PreferredAddressPage /> },
          { path: 'subscriptions', element: <SubscriptionManagementPage /> },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
