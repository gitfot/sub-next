import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeLinkPage } from '../node-link-page.js';
import { PreferredAddressPage } from '../preferred-address-page.js';
import { SubscriptionManagementPage } from '../subscription-management-page.js';

describe('data management pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('creates, edits, and deletes a node-link dataset', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'node-1',
        name: '香港节点',
        description: '首选',
        content: 'vmess://demo',
        updatedAt: '2026-05-17T00:00:00.000Z',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'node-1',
            name: '香港节点',
            description: '首选',
            content: 'vmess://demo',
            updatedAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'node-1',
        name: '香港节点-更新',
        description: '已编辑',
        content: 'vmess://updated',
        updatedAt: '2026-05-17T00:02:00.000Z',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'node-1',
            name: '香港节点-更新',
            description: '已编辑',
            content: 'vmess://updated',
            updatedAt: '2026-05-17T00:02:00.000Z',
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));

    render(
      <MemoryRouter>
        <NodeLinkPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: '新增节点链接' }));
    await user.type(screen.getByLabelText('名称'), '香港节点');
    await user.type(screen.getByLabelText('描述'), '首选');
    await user.type(screen.getByLabelText('内容'), 'vmess://demo');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('香港节点')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '编辑' }));
    await user.clear(screen.getByLabelText('名称'));
    await user.type(screen.getByLabelText('名称'), '香港节点-更新');
    await user.clear(screen.getByLabelText('内容'));
    await user.type(screen.getByLabelText('内容'), 'vmess://updated');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('香港节点-更新')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(screen.queryByText('香港节点-更新')).not.toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith('/api/sources/node-links/node-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('creates and edits a preferred-address dataset', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'pref-1',
        name: 'Cloudflare 优选',
        description: '',
        content: '104.16.1.2#HK',
        updatedAt: '2026-05-17T00:00:00.000Z',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'pref-1',
            name: 'Cloudflare 优选',
            description: '',
            content: '104.16.1.2#HK',
            updatedAt: '2026-05-17T00:00:00.000Z',
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'pref-1',
        name: 'Cloudflare 优选-更新',
        description: '带 2053 端口',
        content: '104.17.2.3:2053#US',
        updatedAt: '2026-05-17T00:02:00.000Z',
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'pref-1',
            name: 'Cloudflare 优选-更新',
            description: '带 2053 端口',
            content: '104.17.2.3:2053#US',
            updatedAt: '2026-05-17T00:02:00.000Z',
          },
        ],
      })));

    render(
      <MemoryRouter>
        <PreferredAddressPage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: '新增优选地址' }));
    await user.type(screen.getByLabelText('名称'), 'Cloudflare 优选');
    await user.type(screen.getByLabelText('内容'), '104.16.1.2#HK');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('Cloudflare 优选')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '编辑' }));
    await user.clear(screen.getByLabelText('名称'));
    await user.type(screen.getByLabelText('名称'), 'Cloudflare 优选-更新');
    await user.type(screen.getByLabelText('描述'), '带 2053 端口');
    await user.clear(screen.getByLabelText('内容'));
    await user.type(screen.getByLabelText('内容'), '104.17.2.3:2053#US');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('Cloudflare 优选-更新')).toBeInTheDocument();
  });
});

describe('subscription management', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows details, copies public url, deletes, and restores a subscription', async () => {
    const user = userEvent.setup();
    const clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });

    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'sub-1',
            remark: '测试订阅',
            subscriptionType: 'clash',
            createdAt: '2026-05-15T00:00:00.000Z',
            expiresAt: '2030-01-01T00:00:00.000Z',
            status: 'active',
            publicUrl: 'http://localhost:4000/subscriptions/public/demo-token',
          },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        subscription: {
          id: 'sub-1',
          remark: '测试订阅',
          subscriptionType: 'clash',
          createdAt: '2026-05-15T00:00:00.000Z',
          expiresAt: '2030-01-01T00:00:00.000Z',
          status: 'active',
          publicUrl: 'http://localhost:4000/subscriptions/public/demo-token',
        },
        snapshot: {
          nodeLinksInput: 'vmess://demo',
          preferredAddressesInput: '104.16.1.2#HK',
          namePrefix: 'CF',
          keepOriginalHost: true,
          previewNodes: [{ name: 'node-1', server: '104.16.1.2', port: 443 }],
        },
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nodeLinksInput: 'vmess://demo',
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
        requiresRegenerate: true,
      })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [],
      })));

    render(
      <MemoryRouter>
        <SubscriptionManagementPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('测试订阅')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '详情' }));
    const dialog = await screen.findByRole('dialog', { name: '订阅详情' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('测试订阅')).toBeInTheDocument();
    expect(within(dialog).getByText('vmess://demo')).toBeInTheDocument();
    expect(within(dialog).getByText('104.16.1.2#HK')).toBeInTheDocument();
    const subscriptionRow = screen.getByText('测试订阅').closest('tr');
    expect(subscriptionRow).not.toBeNull();
    expect(within(subscriptionRow as HTMLTableRowElement).queryByRole('button', { name: '复制' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: '复制' }));
    expect(clipboardWriteText).toHaveBeenCalledWith('http://localhost:4000/subscriptions/public/demo-token');

    await user.click(screen.getByRole('button', { name: '关闭' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '订阅详情' })).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: '恢复' }));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/subscriptions/sub-1/restore'),
      expect.any(Object),
    );

    await user.click(screen.getByRole('button', { name: '删除' }));
    await waitFor(() => {
      expect(screen.queryByText('测试订阅')).not.toBeInTheDocument();
    });
  });
});
