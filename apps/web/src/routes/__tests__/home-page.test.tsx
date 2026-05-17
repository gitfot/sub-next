import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveHomeDraftFromRestore } from '../../app/home-draft.js';
import { HomePage } from '../home-page.js';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('home page', () => {
  it('previews nodes and publishes one subscription link', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'node-1', name: '机场A', content: 'vmess://saved-node' }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'pref-1', name: 'Cloudflare', content: '104.16.1.2#HK' }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        warnings: [],
        nodes: [
          { name: 'node-1', type: 'vmess', server: '104.16.1.2', port: 443, hostHeader: 'edge.example.com', sni: 'edge.example.com' },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        publicUrl: 'http://localhost:4000/subscriptions/public/demo-token',
      })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('节点链接'), 'vmess://demo');
    await user.type(screen.getByLabelText('优选地址'), '104.16.1.2#HK');
    await user.click(screen.getByRole('button', { name: '生成节点' }));

    expect(await screen.findByText('node-1')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('订阅类型'), 'clash');
    await user.type(screen.getByLabelText('备注'), '测试订阅');
    await user.click(screen.getByRole('button', { name: '生成订阅' }));

    expect(await screen.findByDisplayValue('http://localhost:4000/subscriptions/public/demo-token')).toBeInTheDocument();
  });

  it('publishes without remark when the field is left blank', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'node-1', name: '机场A', content: 'vmess://saved-node' }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'pref-1', name: 'Cloudflare', content: '104.16.1.2#HK' }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        warnings: [],
        nodes: [
          { name: 'node-1', type: 'vmess', server: '104.16.1.2', port: 443, hostHeader: 'edge.example.com', sni: 'edge.example.com' },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        publicUrl: 'http://localhost:4000/subscriptions/public/demo-token',
      })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText('节点链接'), 'vmess://demo');
    await user.type(screen.getByLabelText('优选地址'), '104.16.1.2#HK');
    await user.click(screen.getByRole('button', { name: '生成节点' }));
    await screen.findByText('node-1');

    await user.click(screen.getByRole('button', { name: '生成订阅' }));

    const publishCall = fetchSpy.mock.calls.find((call) => call[0] === '/api/subscriptions');
    expect(publishCall?.[0]).toBe('/api/subscriptions');
    expect(JSON.parse(String((publishCall?.[1] as RequestInit)?.body))).not.toHaveProperty('remark');
  });

  it('loads saved datasets into the editable homepage inputs', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'node-1', name: '机场A', content: 'vmess://saved-node' }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'pref-1', name: 'Cloudflare', content: '104.16.1.2#HK' }],
      })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await user.selectOptions(await screen.findByLabelText('节点链接来源'), 'node-1');
    await user.selectOptions(screen.getByLabelText('优选地址来源'), 'pref-1');

    expect(screen.getByLabelText('节点链接')).toHaveValue('vmess://saved-node');
    expect(screen.getByLabelText('优选地址')).toHaveValue('104.16.1.2#HK');
  });

  it('restores draft input after leaving and returning to the homepage', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'node-1', name: '机场A', content: 'vmess://saved-node' }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'pref-1', name: 'Cloudflare', content: '104.16.1.2#HK' }],
      })));

    const { unmount } = render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await user.type(await screen.findByLabelText('节点链接'), 'vmess://draft');
    await user.type(screen.getByLabelText('优选地址'), '104.16.1.2#HK');
    unmount();

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('节点链接')).toHaveValue('vmess://draft');
    expect(screen.getByLabelText('优选地址')).toHaveValue('104.16.1.2#HK');
  });

  it('requires regenerate after restoring from subscription history', async () => {
    saveHomeDraftFromRestore({
      nodeLinksInput: 'vmess://restored',
      preferredAddressesInput: '104.16.1.2#HK',
      namePrefix: 'CF',
      keepOriginalHost: true,
      requiresRegenerate: true,
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByDisplayValue('vmess://restored')).toBeInTheDocument();
    expect(screen.getByText('已从历史订阅恢复输入，请重新生成节点后再发布。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成订阅' })).toBeDisabled();
  });
});
