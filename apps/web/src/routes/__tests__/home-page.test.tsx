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
  async function addManualInput(user: ReturnType<typeof userEvent.setup>, kind: '节点链接' | '优选地址', value: string) {
    await user.click(screen.getByRole('button', { name: `新增${kind}输入` }));
    await user.type(await screen.findByLabelText(`${kind} 1`), value);
  }

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

    await addManualInput(user, '节点链接', 'vmess://demo');
    await addManualInput(user, '优选地址', '104.16.1.2#HK');
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

    await addManualInput(user, '节点链接', 'vmess://demo');
    await addManualInput(user, '优选地址', '104.16.1.2#HK');
    await user.click(screen.getByRole('button', { name: '生成节点' }));
    await screen.findByText('node-1');

    await user.click(screen.getByRole('button', { name: '生成订阅' }));

    const publishCall = fetchSpy.mock.calls.find((call) => call[0] === '/api/subscriptions');
    expect(publishCall?.[0]).toBe('/api/subscriptions');
    expect(JSON.parse(String((publishCall?.[1] as RequestInit)?.body))).not.toHaveProperty('remark');
  });

  it('keeps manual inputs separate while merging them with selected dataset content', async () => {
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

    await user.click(screen.getByRole('button', { name: '新增节点链接输入' }));
    await user.click(screen.getByRole('button', { name: '新增优选地址输入' }));

    const nodeInput = await screen.findByLabelText('节点链接 1');
    const preferredInput = screen.getByLabelText('优选地址 1');

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
      nodeLinksInput: 'vmess://saved-node\nvmess://manual',
      preferredAddressesInput: '104.16.1.2#HK\n198.51.100.1#Manual',
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

    expect(await screen.findByLabelText('编辑 机场A 内容')).toHaveValue('vmess://saved-node\nvless://saved-node-2');
    expect(checkbox).not.toBeChecked();
  });

  it('uses edited expanded dataset content for preview without saving back to data management', async () => {
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

    await user.click(await screen.findByRole('button', { name: '展开 机场A 预览' }));
    const datasetEditor = await screen.findByLabelText('编辑 机场A 内容');
    await user.clear(datasetEditor);
    await user.type(datasetEditor, 'vmess://edited-node');

    await user.click(screen.getByRole('checkbox', { name: '机场A' }));
    await user.click(screen.getByRole('checkbox', { name: 'Cloudflare' }));
    await user.click(screen.getByRole('button', { name: '生成节点' }));

    const previewCall = fetchSpy.mock.calls.find((call) => call[0] === '/api/generator/preview');
    expect(previewCall?.[0]).toBe('/api/generator/preview');
    expect(JSON.parse(String((previewCall?.[1] as RequestInit)?.body))).toMatchObject({
      nodeLinksInput: 'vmess://edited-node',
      preferredAddressesInput: '104.16.1.2#HK',
    });
  });

  it('shows full expanded dataset content instead of truncated remaining-count text', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [{
          id: 'node-1',
          name: 'default',
          content: '108.162.198.88\n108.162.198.52\n172.64.52.77\n162.159.44.136\n104.16.1.2\n104.17.2.3\n104.18.3.4\n104.19.4.5\n104.20.5.6\n104.21.6.7\n104.22.7.8\n104.23.8.9',
        }],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [],
      })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    await user.click(await screen.findByRole('button', { name: '展开 default 预览' }));

    expect(await screen.findByLabelText('编辑 default 内容')).toHaveValue(
      '108.162.198.88\n108.162.198.52\n172.64.52.77\n162.159.44.136\n104.16.1.2\n104.17.2.3\n104.18.3.4\n104.19.4.5\n104.20.5.6\n104.21.6.7\n104.22.7.8\n104.23.8.9',
    );
    expect(screen.queryByText(/还有 \d+ 条/)).not.toBeInTheDocument();
  });

  it('keeps manual inputs hidden until the add button is clicked', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('点击右侧 + 按钮后新增一条输入，内容仅保存在当前首页草稿里。')).not.toBeInTheDocument();
    expect(screen.queryByText('此处内容与上方数据集完全独立，互不影响。')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('节点链接 1')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('优选地址 1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '新增节点链接输入' }));
    await user.click(screen.getByRole('button', { name: '新增优选地址输入' }));

    expect(await screen.findByLabelText('节点链接 1')).toBeInTheDocument();
    expect(screen.getByLabelText('优选地址 1')).toBeInTheDocument();
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

    await addManualInput(user, '节点链接', 'vmess://draft');
    await addManualInput(user, '优选地址', '104.16.1.2#HK');
    unmount();

    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [] })));

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(await screen.findByLabelText('节点链接 1')).toHaveValue('vmess://draft');
    expect(screen.getByLabelText('优选地址 1')).toHaveValue('104.16.1.2#HK');
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

    expect(await screen.findByLabelText('节点链接 1')).toHaveValue('vmess://restored-manual');
    expect(screen.getByLabelText('优选地址 1')).toHaveValue('104.20.5.6#TW');
    expect(screen.getByText('已从历史订阅恢复输入，请重新生成节点后再发布。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '生成订阅' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '机场A' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: '机场B' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cloudflare' })).toBeChecked();
  });
});
