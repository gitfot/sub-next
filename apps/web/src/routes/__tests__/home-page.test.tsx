import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from '../home-page.js';

describe('home page', () => {
  it('previews nodes and publishes one subscription link', async () => {
    const user = userEvent.setup();
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        warnings: [],
        nodes: [
          { name: 'node-1', type: 'vmess', server: '104.16.1.2', port: 443, hostHeader: 'edge.example.com', sni: 'edge.example.com' },
        ],
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        publicUrl: 'http://localhost:4000/subscriptions/public/demo-token',
      })));

    render(<HomePage />);

    await user.type(screen.getByLabelText('节点链接'), 'vmess://demo');
    await user.type(screen.getByLabelText('优选地址'), '104.16.1.2#HK');
    await user.click(screen.getByRole('button', { name: '生成节点' }));

    expect(await screen.findByText('node-1')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('订阅类型'), 'clash');
    await user.type(screen.getByLabelText('备注'), '测试订阅');
    await user.click(screen.getByRole('button', { name: '生成订阅' }));

    expect(await screen.findByDisplayValue('http://localhost:4000/subscriptions/public/demo-token')).toBeInTheDocument();
  });
});
