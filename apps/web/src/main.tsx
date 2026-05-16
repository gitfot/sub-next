import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './app/router.js';
import { queryClient } from './app/query-client.js';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root element');
}

ReactDOM.createRoot(rootElement).render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={createAppRouter()} />
  </QueryClientProvider>,
);
