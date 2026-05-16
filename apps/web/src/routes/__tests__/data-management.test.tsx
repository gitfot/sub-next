import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionManagementPage } from '../subscription-management-page.js';

describe('subscription management', () => {
  it('shows details and triggers restore', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'sub-1',
            remark: '测试订阅',
            subscriptionType: 'clash',
            createdAt: '2026-05-15T00:00:00.000Z',
            expiresAt: '2030-01-01T00:00:00.000Z',
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nodeLinksInput: 'vmess://demo',
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
      })));

    render(
      <MemoryRouter>
        <SubscriptionManagementPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('测试订阅')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '恢复' }));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/subscriptions/sub-1/restore'),
      expect.any(Object),
    );
  });
});
