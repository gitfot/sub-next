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

  it('keeps manual inputs separate while still sending selected dataset ids', async () => {
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
      })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const nodeInput = await screen.findByLabelText('节点链接');
    const preferredInput = screen.getByLabelText('优选地址');

    await user.type(nodeInput, 'vmess://manual');
    await user.type(preferredInput, '198.51.100.1#Manual');
    await user.click(screen.getByRole('checkbox', { name: '机场A' }));
    await user.click(screen.getByRole('checkbox', { name: 'Cloudflare' }));

    expect(nodeInput).toHaveValue('vmess://manual');
    expect(preferredInput).toHaveValue('198.51.100.1#Manual');

    await user.click(screen.getByRole('button', { name: '生成节点' }));

    const previewCall = fetchSpy.mock.calls.find((call) => call[0] === '/api/generator/preview');
    expect(previewCall?.[0]).toBe('/api/generator/preview');
    expect(JSON.parse(String((previewCall?.[1] as RequestInit)?.body))).toMatchObject({
      nodeLinkSetIds: ['node-1'],
      preferredAddressSetIds: ['pref-1'],
      nodeLinksInput: 'vmess://manual',
      preferredAddressesInput: '198.51.100.1#Manual',
    });
  });

  it('expands dataset previews without auto-selecting the dataset', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'node-1', name: '机场A', content: 'vmess://saved-node\nvless://saved-node-2' }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [],
      })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    const checkbox = await screen.findByRole('checkbox', { name: '机场A' });
    const expandButton = screen.getByRole('button', { name: '展开 机场A 预览' });

    expect(checkbox).not.toBeChecked();
    await user.click(expandButton);

    expect(await screen.findByText('vmess://saved-node')).toBeInTheDocument();
    expect(screen.getByText('vless://saved-node-2')).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
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
      nodeLinkSetIds: ['node-1', 'node-2'],
      preferredAddressSetIds: ['pref-1'],
      nodeLinksInput: 'vmess://restored-manual',
      preferredAddressesInput: '104.20.5.6#TW',
      namePrefix: 'CF',
      keepOriginalHost: true,
      requiresRegenerate: true,
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          { id: 'node-1', name: '机场A', content: 'vmess://saved-node' },
          { id: 'node-2', name: '机场B', content: 'trojan://saved-node-2' },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{ id: 'pref-1', name: 'Cloudflare', content: '104.16.1.2#HK' }],
      })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('节点链接')).toHaveValue('vmess://restored-manual');
    expect(screen.getByLabelText('优选地址')).toHaveValue('104.20.5.6#TW');
    expect(screen.getByText('已从历史订阅恢复输入，请重新生成节点后再发布。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成订阅' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '机场A' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '机场B' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cloudflare' })).toBeChecked();
  });
});
