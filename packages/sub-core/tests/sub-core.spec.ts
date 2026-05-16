import { describe, expect, it } from 'vitest';
import {
  expandNodes,
  parseNodeLinks,
  parsePreferredAddresses,
  renderSubscription,
} from '../src/index.js';

const vmess =
  'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ==';

describe('sub-core compatibility', () => {
  it('parses node links and preferred addresses', () => {
    const { nodes } = parseNodeLinks(vmess);
    const { endpoints } = parsePreferredAddresses('104.16.1.2#HK\n104.17.2.3:2053#US');

    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.type).toBe('vmess');
    expect(endpoints).toHaveLength(2);
  });

  it('expands nodes and preserves original host fields', () => {
    const { nodes } = parseNodeLinks(vmess);
    const { endpoints } = parsePreferredAddresses('104.16.1.2#HK');
    const expanded = expandNodes(nodes, endpoints, { keepOriginalHost: true, namePrefix: 'CF' });

    expect(expanded.nodes).toHaveLength(1);
    expect(expanded.nodes[0]?.server).toBe('104.16.1.2');
    expect(expanded.nodes[0]?.hostHeader).toBe('edge.example.com');
  });

  it('renders one target at a time', () => {
    const { nodes } = parseNodeLinks(vmess);
    const { endpoints } = parsePreferredAddresses('104.16.1.2#HK');
    const expanded = expandNodes(nodes, endpoints, { keepOriginalHost: true });

    expect(renderSubscription('v2rayn', expanded.nodes, 'https://example.com').body.length).toBeGreaterThan(10);
    expect(renderSubscription('clash', expanded.nodes, 'https://example.com').body).toContain('proxies:');
    expect(renderSubscription('surge', expanded.nodes, 'https://example.com').body).toContain('[Proxy]');
    expect(renderSubscription('shadowrocket', expanded.nodes, 'https://example.com').body.length).toBeGreaterThan(10);
  });
});
