# CloudflareSub Server Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new multi-user, server-hosted CloudflareSub product in a fresh TypeScript monorepo, migrate the reusable subscription core logic from the current Worker project, and deliver the first usable release with login, homepage generation, data management, public subscription publishing, and restore flow.

**Architecture:** Create a new sibling project root at `cloudflaresub-next/` and keep the current Worker repository frozen as a read-only business-rules reference. Implement the new product as a modular monolith with `apps/web`, `apps/api`, `packages/sub-core`, and `packages/shared`, backed by PostgreSQL. Redis is deferred to a future phase. Persist published subscriptions as immutable snapshots so public access never recalculates from mutable datasets.

**Tech Stack:** Node.js, TypeScript, pnpm workspaces, React, Vite, React Router, TanStack Query, Fastify, `@fastify/cors`, `@fastify/rate-limit`, Prisma, PostgreSQL, Zod, `jose` (JWT), `@node-rs/bcrypt`, Vitest, Testing Library, Supertest, Docker Compose

---

## File Structure

All implementation paths below are relative to the new project root `cloudflaresub-next/`.

- `package.json`
  Responsibility: root workspace scripts and shared dev dependencies.
- `tsconfig.base.json`
  Responsibility: shared TypeScript compiler settings.
- `.gitignore`
  Responsibility: ignore `node_modules`, build output, env files, database artifacts, and editor state.
- `apps/api/`
  Responsibility: Fastify API, auth, data isolation, generation, publishing, public subscription serving.
- `apps/web/`
  Responsibility: login, register, homepage tool, data management screens, restore flow.
- `packages/sub-core/`
  Responsibility: migrated and typed parsing, expansion, warnings, and target rendering logic.
- `packages/shared/`
  Responsibility: shared Zod schemas, route DTO types, enums, and small client-safe constants.
- `prisma/schema.prisma`
  Responsibility: first-phase relational data model and indexes.
- `deploy/docker-compose.yml`
  Responsibility: local deployment stack for web, api, and postgres.
- `README.md`
  Responsibility: bootstrap, environment, and verification instructions for the new system.

Reference-only files from the frozen Worker project:

- `cloudflaresub/src/core.js`
- `cloudflaresub/tests/smoke.mjs`

## Task 1: Create The New Workspace Skeleton

**Files:**
- Create: `cloudflaresub-next/.gitignore`
- Create: `cloudflaresub-next/package.json`
- Create: `cloudflaresub-next/tsconfig.base.json`
- Create: `cloudflaresub-next/apps/api/package.json`
- Create: `cloudflaresub-next/apps/web/package.json`
- Create: `cloudflaresub-next/packages/shared/package.json`
- Create: `cloudflaresub-next/packages/sub-core/package.json`
- Create: `cloudflaresub-next/README.md`

- [ ] **Step 1: Create the root workspace files**

```json
// cloudflaresub-next/package.json
{
  "name": "cloudflaresub-next",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev:api": "pnpm --filter @cloudflaresub/api dev",
    "dev:web": "pnpm --filter @cloudflaresub/web dev",
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "lint": "pnpm -r run lint",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push"
  },
  "devDependencies": {
    "@types/node": "^24.0.0",
    "prisma": "^6.8.0",
    "typescript": "^5.8.3"
  }
}
```

```json
// cloudflaresub-next/tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "baseUrl": ".",
    "paths": {
      "@cloudflaresub/shared/*": [
        "packages/shared/src/*"
      ],
      "@cloudflaresub/sub-core/*": [
        "packages/sub-core/src/*"
      ]
    }
  }
}
```

```gitignore
# cloudflaresub-next/.gitignore
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
.DS_Store
*.log
.vite/
.turbo/
.idea/
.vscode/
tmp/
```

- [ ] **Step 2: Create minimal workspace package manifests**

```yaml
# cloudflaresub-next/pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// cloudflaresub-next/apps/api/package.json
{
  "name": "@cloudflaresub/api",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  }
}
```

```json
// cloudflaresub-next/apps/web/package.json
{
  "name": "@cloudflaresub/web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  }
}
```

```json
// cloudflaresub-next/packages/shared/package.json
{
  "name": "@cloudflaresub/shared",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  }
}
```

```json
// cloudflaresub-next/packages/sub-core/package.json
{
  "name": "@cloudflaresub/sub-core",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "tsc -p tsconfig.json --noEmit"
  }
}
```

- [ ] **Step 3: Add a bootstrap README before installing dependencies**

```md
# CloudflareSub Next

Second-generation server-hosted rewrite of CloudflareSub.

## Workspaces

- `apps/web`: React homepage and data management UI
- `apps/api`: Fastify API
- `packages/sub-core`: migrated subscription core
- `packages/shared`: shared schemas and types

## First bootstrap

```bash
pnpm install
```
```

- [ ] **Step 4: Install the baseline toolchain**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm install`

Then install workspace dependencies:

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm add fastify @fastify/cors @fastify/rate-limit zod jose @node-rs/bcrypt @prisma/client react react-dom react-router-dom @tanstack/react-query && pnpm add -D tsx vitest @vitest/coverage-v8 supertest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom vite @vitejs/plugin-react eslint`

Expected: install completes with no missing workspace errors.

- [ ] **Step 5: Commit the scaffold**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add .
git commit -m "初始化新架构工作区"
```

## Task 2: Migrate The Subscription Core Into `packages/sub-core`

**Files:**
- Create: `cloudflaresub-next/packages/sub-core/tsconfig.json`
- Create: `cloudflaresub-next/packages/sub-core/vitest.config.ts`
- Create: `cloudflaresub-next/packages/sub-core/src/types.ts`
- Create: `cloudflaresub-next/packages/sub-core/src/helpers.ts`
- Create: `cloudflaresub-next/packages/sub-core/src/parser.ts`
- Create: `cloudflaresub-next/packages/sub-core/src/expand.ts`
- Create: `cloudflaresub-next/packages/sub-core/src/render.ts`
- Create: `cloudflaresub-next/packages/sub-core/src/index.ts`
- Create: `cloudflaresub-next/packages/sub-core/tests/sub-core.spec.ts`
- Read only: `cloudflaresub/src/core.js`
- Read only: `cloudflaresub/tests/smoke.mjs`

- [ ] **Step 1: Write the failing compatibility tests first**

```ts
// cloudflaresub-next/packages/sub-core/tests/sub-core.spec.ts
import { describe, expect, it } from 'vitest';
import {
  expandNodes,
  parseNodeLinks,
  parsePreferredAddresses,
  renderSubscription
} from '../src/index';

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
```

- [ ] **Step 2: Run the compatibility tests and verify they fail**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/sub-core test`

Expected: FAIL because `../src/index` and the exported functions do not exist yet.

- [ ] **Step 3: Port the Worker core into focused TypeScript files**

Port the full logic from `cloudflaresub/src/core.js` into typed TypeScript modules. Every parsing path, rendering path, and helper must be faithfully migrated. The files below contain the complete implementation, not stubs.

```ts
// cloudflaresub-next/packages/sub-core/src/types.ts
export type SubscriptionTarget = 'v2rayn' | 'clash' | 'shadowrocket' | 'surge';

export interface ParsedNode {
  type: 'vmess' | 'vless' | 'trojan';
  name: string;
  server: string;
  originalServer: string;
  port: number;
  uuid?: string;
  password?: string;
  alterId?: number;
  cipher?: string;
  network?: string;
  path?: string;
  hostHeader?: string;
  sni?: string;
  tls: boolean;
  security?: string;
  alpn?: string[];
  fp?: string;
  flow?: string;
  serviceName?: string;
  authority?: string;
  encryption?: string;
  headerType?: string;
  allowInsecure?: boolean;
  endpointLabel?: string;
  endpointSource?: string;
  params?: Record<string, string>;
}
```

```ts
// cloudflaresub-next/packages/sub-core/src/index.ts
export { expandNodes } from './expand.js';
export { parseNodeLinks, parsePreferredAddresses } from './parser.js';
export { renderSubscription } from './render.js';
export type { ParsedNode, SubscriptionTarget } from './types.js';
```

```ts
// cloudflaresub-next/packages/sub-core/src/helpers.ts
// Shared low-level utilities ported from core.js

export function normalizeText(value: string): string {
  return String(value).replace(/\r\n?/g, '\n').trim();
}

export function splitCsvLike(text: string): string[] {
  return normalizeText(text)
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizePort(value: string | number | undefined, fallback?: number): number {
  const num = Number.parseInt(String(value ?? ''), 10);
  if (Number.isInteger(num) && num >= 1 && num <= 65535) return num;
  if (fallback !== undefined) return fallback;
  throw new Error(`端口无效：${value}`);
}

export function normalizeInteger(value: string | number | undefined, fallback = 0): number {
  const num = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizePath(value: string | undefined): string {
  const text = String(value ?? '').trim();
  if (!text) return '/';
  return text.startsWith('/') ? text : `/${text}`;
}

export function splitListValue(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  return String(value ?? '').split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
}

export function isTlsEnabled(value: string | undefined): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'tls' || text === 'xtls' || text === 'reality';
}

export function toBoolean(value: string | boolean | undefined): boolean {
  const text = String(value ?? '').trim().toLowerCase();
  return text === '1' || text === 'true' || text === 'yes';
}

export function decodeHashName(hash: string | undefined): string {
  const raw = String(hash ?? '').replace(/^#/, '');
  if (!raw) return '';
  try { return decodeURIComponent(raw); } catch { return raw; }
}

export function formatHostForUrl(host: string): string {
  if (String(host).includes(':') && !String(host).startsWith('[')) return `[${host}]`;
  return host;
}

export function setQueryParam(params: URLSearchParams, key: string, value: string): void {
  const normalized = String(value ?? '').trim();
  if (normalized) params.set(key, normalized);
  else params.delete(key);
}

export function yamlQuote(value: string | number): string {
  const text = String(value ?? '');
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function sanitizeSurgeName(name: string): string {
  return String(name || 'proxy').replace(/[\r\n]/g, ' ').replace(/,/g, '，').replace(/=/g, '＝').trim();
}

export function escapeSurgeHeader(value: string): string {
  return String(value ?? '').replace(/"/g, '\\"');
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export function encodeBase64Utf8(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

export function decodeBase64Utf8(base64Text: string): string {
  return Buffer.from(normalizeBase64(base64Text), 'base64').toString('utf-8');
}

function normalizeBase64(input: string): string {
  const value = String(input ?? '').trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  return value + padding;
}
```

```ts
// cloudflaresub-next/packages/sub-core/src/parser.ts
// Full parsing logic ported from core.js parseNodeLinks / parsePreferredEndpoints

import type { ParsedNode } from './types.js';
import {
  decodeBase64Utf8,
  decodeHashName,
  isTlsEnabled,
  normalizeInteger,
  normalizePath,
  normalizePort,
  normalizeText,
  splitCsvLike,
  splitListValue,
  toBoolean,
} from './helpers.js';

export interface ParseNodeResult {
  nodes: ParsedNode[];
  warnings: string[];
  normalizedInput: string;
}

export interface PreferredAddress {
  host: string;
  port?: number;
  label?: string;
}

export interface ParseAddressResult {
  endpoints: PreferredAddress[];
  warnings: string[];
}

export function parseNodeLinks(inputText: string): ParseNodeResult {
  const normalizedInput = maybeExpandRawSubscription(inputText);
  const lines = normalizedInput.split('\n').map((line) => line.trim()).filter(Boolean);
  const nodes: ParsedNode[] = [];
  const warnings: string[] = [];

  lines.forEach((line, index) => {
    try {
      nodes.push(parseSingleNode(line));
    } catch (error) {
      warnings.push(`第 ${index + 1} 行解析失败：${(error as Error).message}`);
    }
  });

  return { nodes, warnings, normalizedInput };
}

export function parsePreferredAddresses(inputText: string): ParseAddressResult {
  const items = splitCsvLike(inputText);
  const endpoints: PreferredAddress[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  items.forEach((raw, index) => {
    try {
      const endpoint = parseEndpoint(raw);
      const dedupeKey = `${endpoint.host}:${endpoint.port ?? ''}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      endpoints.push(endpoint);
    } catch (error) {
      warnings.push(`第 ${index + 1} 个优选地址解析失败：${(error as Error).message}`);
    }
  });

  return { endpoints, warnings };
}

function maybeExpandRawSubscription(inputText: string): string {
  const text = normalizeText(inputText);
  if (!text || text.includes('://')) return text;
  if (!/^[A-Za-z0-9+/=_-]+$/.test(text)) return text;
  try {
    const decoded = decodeBase64Utf8(text);
    if (decoded.includes('://')) return decoded;
  } catch { /* ignore */ }
  return text;
}

function parseSingleNode(uri: string): ParsedNode {
  const lower = uri.toLowerCase();
  if (lower.startsWith('vmess://')) return parseVmessUri(uri);
  if (lower.startsWith('vless://')) return parseVlessUri(uri);
  if (lower.startsWith('trojan://')) return parseTrojanUri(uri);
  throw new Error('只支持 vmess://、vless://、trojan://');
}

function parseEndpoint(rawLine: string): PreferredAddress {
  const raw = String(rawLine).trim();
  if (!raw) throw new Error('优选地址为空');
  const hashIndex = raw.indexOf('#');
  const hostPart = hashIndex >= 0 ? raw.slice(0, hashIndex).trim() : raw;
  const label = hashIndex >= 0 ? raw.slice(hashIndex + 1).trim() : '';
  const { host, port } = splitHostAndPort(hostPart);
  if (!host) throw new Error(`无效地址：${raw}`);
  return { host, port, label };
}

function splitHostAndPort(input: string): { host: string; port?: number } {
  const value = String(input).trim();
  if (!value) return { host: '' };
  if (value.startsWith('[')) {
    const match = value.match(/^\[([^\]]+)](?::(\d+))?$/);
    if (!match) throw new Error(`IPv6 地址格式错误：${value}`);
    return { host: match[1]!, port: match[2] ? normalizePort(match[2]) : undefined };
  }
  const colonCount = (value.match(/:/g) ?? []).length;
  if (colonCount > 1) return { host: value };
  const parts = value.split(':');
  if (parts.length === 2 && /^\d+$/.test(parts[1]!)) {
    return { host: parts[0]!, port: normalizePort(parts[1]!) };
  }
  return { host: value };
}

function parseVmessUri(uri: string): ParsedNode {
  const encoded = uri.slice('vmess://'.length).trim();
  const jsonText = decodeBase64Utf8(encoded);
  const data = JSON.parse(jsonText);
  const server = String(data.add ?? '').trim();
  const port = normalizePort(data.port, 443);
  const uuid = String(data.id ?? '').trim();
  if (!server || !uuid) throw new Error('VMess 链接缺少 add 或 id');

  return {
    type: 'vmess',
    name: String(data.ps || 'vmess').trim() || 'vmess',
    server,
    originalServer: server,
    port,
    uuid,
    alterId: normalizeInteger(data.aid, 0),
    cipher: String(data.scy || data.cipher || 'auto').trim() || 'auto',
    network: String(data.net || 'ws').trim() || 'ws',
    path: normalizePath(data.path || '/'),
    hostHeader: String(data.host ?? '').trim(),
    sni: String(data.sni ?? '').trim(),
    tls: isTlsEnabled(data.tls),
    security: String(data.tls ?? '').trim(),
    alpn: splitListValue(data.alpn),
    fp: String(data.fp ?? '').trim(),
    headerType: String(data.type ?? '').trim(),
    allowInsecure: toBoolean(data.allowInsecure),
    params: {},
  };
}

function parseVlessUri(uri: string): ParsedNode {
  const url = new URL(uri);
  const params = Object.fromEntries(url.searchParams.entries());
  const server = url.hostname;
  const port = normalizePort(url.port || params['port'], 443);
  const uuid = decodeURIComponent(url.username || '').trim();
  if (!server || !uuid) throw new Error('VLESS 链接缺少主机或 UUID');

  const network = String(params['type'] || 'tcp').trim() || 'tcp';
  const security = String(params['security'] ?? '').trim();
  return {
    type: 'vless',
    name: decodeHashName(url.hash) || 'vless',
    server,
    originalServer: server,
    port,
    uuid,
    network,
    path: normalizePath(params['path'] ?? ''),
    hostHeader: String(params['host'] ?? '').trim(),
    sni: String(params['sni'] || params['peer'] || '').trim(),
    tls: security === 'tls' || security === 'reality',
    security,
    alpn: splitListValue(params['alpn']),
    fp: String(params['fp'] ?? '').trim(),
    allowInsecure: toBoolean(params['allowInsecure'] || params['insecure']),
    flow: String(params['flow'] ?? '').trim(),
    serviceName: String(params['serviceName'] ?? '').trim(),
    authority: String(params['authority'] ?? '').trim(),
    encryption: String(params['encryption'] || 'none').trim() || 'none',
    params,
  };
}

function parseTrojanUri(uri: string): ParsedNode {
  const url = new URL(uri);
  const params = Object.fromEntries(url.searchParams.entries());
  const server = url.hostname;
  const port = normalizePort(url.port || params['port'], 443);
  const password = decodeURIComponent(url.username || '').trim();
  if (!server || !password) throw new Error('Trojan 链接缺少主机或密码');

  const security = String(params['security'] || 'tls').trim() || 'tls';
  return {
    type: 'trojan',
    name: decodeHashName(url.hash) || 'trojan',
    server,
    originalServer: server,
    port,
    password,
    network: String(params['type'] || 'tcp').trim() || 'tcp',
    path: normalizePath(params['path'] ?? ''),
    hostHeader: String(params['host'] ?? '').trim(),
    sni: String(params['sni'] || params['peer'] || '').trim(),
    tls: security === 'tls',
    security,
    alpn: splitListValue(params['alpn']),
    fp: String(params['fp'] ?? '').trim(),
    allowInsecure: toBoolean(params['allowInsecure'] || params['insecure']),
    serviceName: String(params['serviceName'] ?? '').trim(),
    authority: String(params['authority'] ?? '').trim(),
    params,
  };
}
```

```ts
// cloudflaresub-next/packages/sub-core/src/expand.ts
// Full expansion logic ported from core.js expandNodes

import type { ParsedNode } from './types.js';
import type { PreferredAddress } from './parser.js';
import { deepClone } from './helpers.js';

export interface ExpandOptions {
  keepOriginalHost: boolean;
  namePrefix?: string;
}

export interface ExpandResult {
  nodes: ParsedNode[];
  warnings: string[];
}

export function expandNodes(
  baseNodes: ParsedNode[],
  endpoints: PreferredAddress[],
  options: ExpandOptions
): ExpandResult {
  const keepOriginalHost = options.keepOriginalHost !== false;
  const namePrefix = String(options.namePrefix ?? '').trim();
  const warnings: string[] = [];
  const expanded: ParsedNode[] = [];

  baseNodes.forEach((baseNode) => {
    const originalTlsHost = getEffectiveTlsHost(baseNode);
    if (keepOriginalHost && !originalTlsHost) {
      warnings.push(`节点「${baseNode.name}」缺少 Host/SNI/原始域名，替换成优选 IP 后可能无法握手。`);
    }

    endpoints.forEach((endpoint, index) => {
      const port = endpoint.port ?? baseNode.port;
      const label = endpoint.label || `${endpoint.host}:${port}`;
      const suffix = namePrefix ? `${namePrefix}-${index + 1}` : label;
      const clone = deepClone(baseNode);
      clone.server = endpoint.host;
      clone.port = port;
      clone.name = buildNodeName(baseNode.name, suffix);
      clone.endpointLabel = endpoint.label ?? '';
      clone.endpointSource = `${endpoint.host}:${port}`;

      if (keepOriginalHost) {
        clone.sni = baseNode.sni || baseNode.hostHeader || baseNode.originalServer || '';
        clone.hostHeader = baseNode.hostHeader || baseNode.sni || baseNode.originalServer || '';
      } else {
        if (!baseNode.sni || baseNode.sni === baseNode.originalServer) {
          clone.sni = endpoint.host;
        }
        if (!baseNode.hostHeader || baseNode.hostHeader === baseNode.originalServer) {
          clone.hostHeader = endpoint.host;
        }
      }

      expanded.push(clone);
    });
  });

  return { nodes: expanded, warnings };
}

function getEffectiveTlsHost(node: ParsedNode): string {
  return String(node.sni || node.hostHeader || node.originalServer || '').trim();
}

function buildNodeName(baseName: string, suffix: string): string {
  const cleanBase = String(baseName || '').trim() || 'node';
  const cleanSuffix = String(suffix || '').trim();
  return cleanSuffix ? `${cleanBase} | ${cleanSuffix}` : cleanBase;
}
```

```ts
// cloudflaresub-next/packages/sub-core/src/render.ts
// Full rendering logic ported from core.js renderSubscription / renderNodeUri / renderClash / renderSurge

import type { ParsedNode, SubscriptionTarget } from './types.js';
import {
  encodeBase64Utf8,
  escapeSurgeHeader,
  formatHostForUrl,
  sanitizeSurgeName,
  yamlQuote,
} from './helpers.js';

const DEFAULT_TEST_URL = 'http://cp.cloudflare.com/generate_204';

export interface RenderResult {
  body: string;
  contentType: string;
  filename: string;
}

export function renderSubscription(
  target: SubscriptionTarget,
  nodes: ParsedNode[],
  requestUrl: string
): RenderResult {
  switch (target) {
    case 'v2rayn':
    case 'shadowrocket':
      return renderRawSubscription(nodes);
    case 'clash':
      return renderClashSubscription(nodes);
    case 'surge':
      return renderSurgeSubscription(nodes, requestUrl);
  }
}

// --- Raw / V2rayN / Shadowrocket ---

function renderRawSubscription(nodes: ParsedNode[]): RenderResult {
  const lines = nodes.map((node) => renderNodeUri(node)).join('\n');
  return {
    body: encodeBase64Utf8(lines),
    contentType: 'text/plain; charset=utf-8',
    filename: 'subscription.txt',
  };
}

function renderNodeUri(node: ParsedNode): string {
  switch (node.type) {
    case 'vmess': return renderVmessUri(node);
    case 'vless': return renderVlessUri(node);
    case 'trojan': return renderTrojanUri(node);
  }
}

function renderVmessUri(node: ParsedNode): string {
  const payload = {
    v: '2',
    ps: node.name,
    add: node.server,
    port: String(node.port),
    id: node.uuid,
    aid: String(node.alterId ?? 0),
    scy: node.cipher || 'auto',
    net: node.network || 'ws',
    type: node.headerType || '',
    host: node.hostHeader || '',
    path: node.path || '/',
    tls: node.tls ? (node.security || 'tls') : '',
    sni: node.sni || '',
    fp: node.fp || '',
    alpn: node.alpn?.length ? node.alpn.join(',') : '',
  };
  return `vmess://${encodeBase64Utf8(JSON.stringify(payload))}`;
}

function renderVlessUri(node: ParsedNode): string {
  const params = new URLSearchParams(node.params ?? {});
  params.set('type', node.network || 'ws');
  params.set('encryption', node.encryption || 'none');
  if (node.security) params.set('security', node.security);
  else if (node.tls) params.set('security', 'tls');
  else params.delete('security');
  setIfPresent(params, 'path', node.path);
  setIfPresent(params, 'host', node.hostHeader);
  setIfPresent(params, 'sni', node.sni);
  setIfPresent(params, 'alpn', node.alpn?.length ? node.alpn.join(',') : '');
  setIfPresent(params, 'fp', node.fp);
  setIfPresent(params, 'flow', node.flow);
  setIfPresent(params, 'serviceName', node.serviceName);
  setIfPresent(params, 'authority', node.authority);
  const hash = node.name ? `#${encodeURIComponent(node.name)}` : '';
  return `vless://${encodeURIComponent(node.uuid!)}@${formatHostForUrl(node.server)}:${node.port}?${params.toString()}${hash}`;
}

function renderTrojanUri(node: ParsedNode): string {
  const params = new URLSearchParams(node.params ?? {});
  params.set('type', node.network || 'ws');
  params.set('security', node.security || 'tls');
  setIfPresent(params, 'path', node.path);
  setIfPresent(params, 'host', node.hostHeader);
  setIfPresent(params, 'sni', node.sni);
  setIfPresent(params, 'alpn', node.alpn?.length ? node.alpn.join(',') : '');
  setIfPresent(params, 'fp', node.fp);
  setIfPresent(params, 'serviceName', node.serviceName);
  setIfPresent(params, 'authority', node.authority);
  const hash = node.name ? `#${encodeURIComponent(node.name)}` : '';
  return `trojan://${encodeURIComponent(node.password!)}@${formatHostForUrl(node.server)}:${node.port}?${params.toString()}${hash}`;
}

function setIfPresent(params: URLSearchParams, key: string, value: string | undefined): void {
  const v = String(value ?? '').trim();
  if (v) params.set(key, v);
  else params.delete(key);
}

// --- Clash ---

function renderClashSubscription(nodes: ParsedNode[]): RenderResult {
  const supported = nodes.filter((n) => ['vmess', 'vless', 'trojan'].includes(n.type));
  if (!supported.length) throw new Error('没有可导出为 Clash 的节点。');

  const proxyNames = supported.map((n) => n.name);
  const lines = [
    '# Generated by CloudflareSub Next',
    'mixed-port: 7890',
    'allow-lan: false',
    'mode: rule',
    'log-level: info',
    'ipv6: false',
    'proxies:',
  ];

  supported.forEach((node) => lines.push(...renderClashProxy(node)));

  lines.push('proxy-groups:');
  lines.push('  - name: "🚀 节点选择"');
  lines.push('    type: select');
  lines.push(`    proxies: ["♻️ 自动选择", ${proxyNames.map(yamlQuote).join(', ')}]`);
  lines.push('  - name: "♻️ 自动选择"');
  lines.push('    type: url-test');
  lines.push(`    url: ${yamlQuote(DEFAULT_TEST_URL)}`);
  lines.push('    interval: 300');
  lines.push('    tolerance: 50');
  lines.push(`    proxies: [${proxyNames.map(yamlQuote).join(', ')}]`);
  lines.push('rules:');
  lines.push('  - MATCH,🚀 节点选择');

  return {
    body: lines.join('\n') + '\n',
    contentType: 'text/yaml; charset=utf-8',
    filename: 'subscription-clash.yaml',
  };
}

function renderClashProxy(node: ParsedNode): string[] {
  const lines = [`  - name: ${yamlQuote(node.name)}`, `    type: ${node.type}`];
  lines.push(`    server: ${yamlQuote(node.server)}`);
  lines.push(`    port: ${node.port}`);
  lines.push('    udp: true');

  if (node.type === 'vmess') {
    lines.push(`    uuid: ${yamlQuote(node.uuid!)}`);
    lines.push(`    alterId: ${node.alterId ?? 0}`);
    lines.push(`    cipher: ${yamlQuote(node.cipher || 'auto')}`);
  }
  if (node.type === 'vless') {
    lines.push(`    uuid: ${yamlQuote(node.uuid!)}`);
    if (node.flow) lines.push(`    flow: ${yamlQuote(node.flow)}`);
  }
  if (node.type === 'trojan') {
    lines.push(`    password: ${yamlQuote(node.password!)}`);
  }

  if (node.tls) {
    lines.push('    tls: true');
    const servername = node.sni || node.hostHeader || node.originalServer;
    if (servername) lines.push(`    servername: ${yamlQuote(servername)}`);
    if (node.alpn?.length) lines.push(`    alpn: [${node.alpn.map(yamlQuote).join(', ')}]`);
    if (node.fp) lines.push(`    client-fingerprint: ${yamlQuote(node.fp)}`);
    lines.push(`    skip-cert-verify: ${node.allowInsecure ? 'true' : 'false'}`);
  }

  lines.push(`    network: ${node.network || 'tcp'}`);

  if (node.network === 'ws') {
    lines.push('    ws-opts:');
    lines.push(`      path: ${yamlQuote(node.path || '/')}`);
    if (node.hostHeader) {
      lines.push('      headers:');
      lines.push(`        Host: ${yamlQuote(node.hostHeader)}`);
    }
  }
  if (node.network === 'grpc') {
    lines.push('    grpc-opts:');
    lines.push(`      grpc-service-name: ${yamlQuote(node.serviceName || '')}`);
  }
  if (node.network === 'http' || node.network === 'h2') {
    lines.push('    http-opts:');
    lines.push(`      path: [${yamlQuote(node.path || '/')}]`);
    if (node.hostHeader) {
      lines.push('      headers:');
      lines.push(`        Host: [${yamlQuote(node.hostHeader)}]`);
    }
  }
  return lines;
}

// --- Surge ---

function renderSurgeSubscription(nodes: ParsedNode[], requestUrl: string): RenderResult {
  const supported = nodes.filter((n) => n.type === 'vmess' || n.type === 'trojan');
  if (!supported.length) throw new Error('当前 Surge 导出仅支持 VMess / Trojan 节点。');

  const proxyNames = supported.map((n) => sanitizeSurgeName(n.name));
  const lines = [
    `#!MANAGED-CONFIG ${requestUrl} interval=86400 strict=false`,
    '',
    '[General]',
    'loglevel = notify',
    `internet-test-url = ${DEFAULT_TEST_URL}`,
    `proxy-test-url = ${DEFAULT_TEST_URL}`,
    'ipv6 = false',
    '',
    '[Proxy]',
  ];

  supported.forEach((node) => lines.push(renderSurgeProxy(node)));

  lines.push('');
  lines.push('[Proxy Group]');
  lines.push(`🚀 节点选择 = select, ♻️ 自动选择, ${proxyNames.join(', ')}`);
  lines.push(`♻️ 自动选择 = url-test, ${proxyNames.join(', ')}, url=${DEFAULT_TEST_URL}, interval=600, tolerance=50`);
  lines.push('');
  lines.push('[Rule]');
  lines.push('FINAL, 🚀 节点选择');
  lines.push('');

  return {
    body: lines.join('\n'),
    contentType: 'text/plain; charset=utf-8',
    filename: 'subscription-surge.conf',
  };
}

function renderSurgeProxy(node: ParsedNode): string {
  const name = sanitizeSurgeName(node.name);
  const sni = node.sni || node.hostHeader || node.originalServer;

  if (node.type === 'vmess') {
    const params = [
      `username=${node.uuid}`,
      'vmess-aead=true',
      `tls=${node.tls ? 'true' : 'false'}`,
      `skip-cert-verify=${node.allowInsecure ? 'true' : 'false'}`,
    ];
    if (sni) params.push(`sni=${sni}`);
    if (node.network === 'ws') {
      params.push('ws=true');
      params.push(`ws-path=${node.path || '/'}`);
      if (node.hostHeader) params.push(`ws-headers=Host:"${escapeSurgeHeader(node.hostHeader)}"`);
    }
    return `${name} = vmess, ${formatHostForUrl(node.server)}, ${node.port}, ${params.join(', ')}`;
  }

  const trojanParams = [
    `password=${node.password}`,
    `skip-cert-verify=${node.allowInsecure ? 'true' : 'false'}`,
  ];
  if (sni) trojanParams.push(`sni=${sni}`);
  if (node.network === 'ws') {
    trojanParams.push('ws=true');
    trojanParams.push(`ws-path=${node.path || '/'}`);
    if (node.hostHeader) trojanParams.push(`ws-headers=Host:"${escapeSurgeHeader(node.hostHeader)}"`);
  }
  return `${name} = trojan, ${formatHostForUrl(node.server)}, ${node.port}, ${trojanParams.join(', ')}`;
}
```

- [ ] **Step 4: Add package-level build and test config**

```json
// cloudflaresub-next/packages/sub-core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "types": [
      "node",
      "vitest/globals"
    ]
  },
  "include": [
    "src",
    "tests",
    "vitest.config.ts"
  ]
}
```

```ts
// cloudflaresub-next/packages/sub-core/vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8'
    }
  }
});
```

- [ ] **Step 5: Re-run the package tests until they pass**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/sub-core test`

Expected: PASS with all compatibility tests green.

- [ ] **Step 6: Commit the migrated core**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add packages/sub-core
git commit -m "迁移订阅核心逻辑"
```

## Task 3: Add Shared Contracts And Database Schema

**Files:**
- Create: `cloudflaresub-next/packages/shared/tsconfig.json`
- Create: `cloudflaresub-next/packages/shared/src/enums.ts`
- Create: `cloudflaresub-next/packages/shared/src/auth.schema.ts`
- Create: `cloudflaresub-next/packages/shared/src/source.schema.ts`
- Create: `cloudflaresub-next/packages/shared/src/subscription.schema.ts`
- Create: `cloudflaresub-next/packages/shared/src/index.ts`
- Create: `cloudflaresub-next/prisma/schema.prisma`
- Create: `cloudflaresub-next/.env.example`

- [ ] **Step 1: Write failing schema tests for request contracts**

```ts
// cloudflaresub-next/packages/shared/src/auth.schema.test.ts
import { describe, expect, it } from 'vitest';
import { registerSchema } from './auth.schema';

describe('registerSchema', () => {
  it('accepts a valid self-service registration payload', () => {
    const payload = registerSchema.parse({
      email: 'demo@example.com',
      username: 'demo_user',
      password: 'strong-password'
    });

    expect(payload.email).toBe('demo@example.com');
  });
});
```

- [ ] **Step 2: Run the shared tests and verify they fail**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/shared test`

Expected: FAIL because the schema files and test config do not exist yet.

- [ ] **Step 3: Create shared enums and Zod schemas used by both web and api**

```ts
// cloudflaresub-next/packages/shared/src/enums.ts
export const subscriptionTargets = ['v2rayn', 'clash', 'shadowrocket', 'surge'] as const;
export type SubscriptionTarget = (typeof subscriptionTargets)[number];
```

```ts
// cloudflaresub-next/packages/shared/src/auth.schema.ts
import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/).optional(),
  password: z.string().min(8).max(128)
});

export const loginSchema = z.object({
  account: z.string().min(3),
  password: z.string().min(8).max(128)
});
```

```ts
// cloudflaresub-next/packages/shared/src/source.schema.ts
import { z } from 'zod';

export const datasetSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  content: z.string().min(1)
});
```

```ts
// cloudflaresub-next/packages/shared/src/subscription.schema.ts
import { z } from 'zod';
import { subscriptionTargets } from './enums';

export const previewRequestSchema = z.object({
  nodeLinkSetId: z.string().uuid().optional(),
  preferredAddressSetId: z.string().uuid().optional(),
  nodeLinksInput: z.string().min(1),
  preferredAddressesInput: z.string().min(1),
  namePrefix: z.string().max(50).optional(),
  keepOriginalHost: z.boolean().default(true)
});

export const publishSubscriptionSchema = previewRequestSchema.extend({
  previewNodes: z.array(z.record(z.string(), z.unknown())).min(1),
  remark: z.string().min(1).max(100),
  expiresAt: z.string().datetime(),
  subscriptionType: z.enum(subscriptionTargets)
});
```

- [ ] **Step 4: Create the Prisma schema from the approved spec**

```prisma
// cloudflaresub-next/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String                    @id @default(uuid())
  email        String                    @unique
  username     String?                   @unique
  passwordHash String
  status       String                    @default("active")
  createdAt    DateTime                  @default(now())
  updatedAt    DateTime                  @updatedAt
  sessions     UserSession[]
  nodeLinkSets NodeLinkSet[]
  addressSets  PreferredAddressSet[]
  subscriptions Subscription[]
  snapshots    SubscriptionSnapshot[]
}

model UserSession {
  id               String   @id @default(uuid())
  userId           String
  refreshTokenHash String
  userAgent        String?
  ipAddress        String?
  expiresAt        DateTime
  createdAt        DateTime @default(now())
  revokedAt        DateTime?
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model NodeLinkSet {
  id          String   @id @default(uuid())
  userId      String
  name        String
  description String?
  content     String   @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  snapshots   SubscriptionSnapshot[]

  @@index([userId])
}

model PreferredAddressSet {
  id          String   @id @default(uuid())
  userId      String
  name        String
  description String?
  content     String   @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  snapshots   SubscriptionSnapshot[]

  @@index([userId])
}

model Subscription {
  id               String                  @id @default(uuid())
  userId           String
  remark           String
  subscriptionType String
  publicToken      String                  @unique
  status           String                  @default("active")
  expiresAt        DateTime
  createdAt        DateTime                @default(now())
  updatedAt        DateTime                @updatedAt
  deletedAt        DateTime?
  user             User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  snapshots        SubscriptionSnapshot[]

  @@index([userId])
}

model SubscriptionSnapshot {
  id                      String                @id @default(uuid())
  subscriptionId          String
  userId                  String
  nodeLinkSetId           String?
  preferredAddressSetId   String?
  nodeLinksInput          String                @db.Text
  preferredAddressesInput String                @db.Text
  generatorOptions        Json
  previewNodesJson        Json
  renderedContent         String                @db.Text
  renderedContentEncoding String
  createdAt               DateTime              @default(now())
  subscription            Subscription          @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)
  user                    User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  nodeLinkSet             NodeLinkSet?          @relation(fields: [nodeLinkSetId], references: [id])
  preferredAddressSet     PreferredAddressSet?  @relation(fields: [preferredAddressSetId], references: [id])

  @@index([subscriptionId])
  @@index([userId])
}
```

- [ ] **Step 5: Add environment defaults and validate the Prisma model**

```env
# cloudflaresub-next/.env.example
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cloudflaresub_next
JWT_ACCESS_SECRET=replace-me-with-a-long-random-string
JWT_REFRESH_SECRET=replace-me-with-a-different-long-random-string
PUBLIC_BASE_URL=http://localhost:3000
API_BASE_URL=http://localhost:4000
```

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm exec prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`.

- [ ] **Step 6: Commit the shared contracts and schema**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add packages/shared prisma .env.example
git commit -m "定义共享契约与数据库模型"
```

## Task 4: Scaffold The API App And Authentication Flow

**Files:**
- Create: `cloudflaresub-next/apps/api/tsconfig.json`
- Create: `cloudflaresub-next/apps/api/vitest.config.ts`
- Create: `cloudflaresub-next/apps/api/src/app.ts`
- Create: `cloudflaresub-next/apps/api/src/server.ts`
- Create: `cloudflaresub-next/apps/api/src/lib/env.ts`
- Create: `cloudflaresub-next/apps/api/src/lib/db.ts`
- Create: `cloudflaresub-next/apps/api/src/lib/auth.ts`
- Create: `cloudflaresub-next/apps/api/src/modules/auth/auth.routes.ts`
- Create: `cloudflaresub-next/apps/api/src/modules/auth/auth.service.ts`
- Create: `cloudflaresub-next/apps/api/tests/auth.integration.test.ts`

- [ ] **Step 1: Write the failing auth integration test**

```ts
// cloudflaresub-next/apps/api/tests/auth.integration.test.ts
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('auth routes', () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  it('registers and logs in a user', async () => {
    const registerResponse = await request(app.server)
      .post('/auth/register')
      .send({
        email: 'demo@example.com',
        username: 'demo_user',
        password: 'strong-password'
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.user.email).toBe('demo@example.com');
    expect(registerResponse.body.tokens.accessToken).toBeTypeOf('string');

    const loginResponse = await request(app.server)
      .post('/auth/login')
      .send({
        account: 'demo@example.com',
        password: 'strong-password'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.tokens.refreshToken).toBeTypeOf('string');
  });
});
```

- [ ] **Step 2: Run the auth test and verify it fails**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/api test -- auth.integration.test.ts`

Expected: FAIL because the API app, route registration, and auth services do not exist yet.

- [ ] **Step 3: Build the Fastify app shell and auth utilities**

```ts
// cloudflaresub-next/apps/api/src/app.ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { authRoutes } from './modules/auth/auth.routes.js';

export function buildApp() {
  const app = Fastify({ logger: false });

  app.register(cors, {
    origin: process.env['WEB_ORIGIN'] || 'http://localhost:3000',
    credentials: true,
  });

  app.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    allowList: [],
  });

  app.register(authRoutes, { prefix: '/auth' });
  return app;
}
```

```ts
// cloudflaresub-next/apps/api/src/lib/auth.ts
// Uses jose (ESM-native JWT) and @node-rs/bcrypt (no node-gyp)
import { hash, verify } from '@node-rs/bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'node:crypto';

const textEncoder = new TextEncoder();

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 12);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return verify(password, passwordHash);
}

export async function signAccessToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(textEncoder.encode(secret));
}

export async function signRefreshToken(userId: string, secret: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(textEncoder.encode(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, textEncoder.encode(secret));
  return { sub: payload.sub as string };
}

export function hashRefreshToken(refreshToken: string): string {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}
```

```ts
// cloudflaresub-next/apps/api/src/modules/auth/auth.service.ts
import { db } from '../../lib/db.js';
import { hashPassword, hashRefreshToken, signAccessToken, signRefreshToken, verifyPassword } from '../../lib/auth.js';
import { getEnv } from '../../lib/env.js';

export async function createUser(input: {
  email: string;
  username?: string;
  password: string;
}) {
  const passwordHash = await hashPassword(input.password);
  const user = await db.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
    },
    select: { id: true, email: true, username: true },
  });

  const tokens = await issueSession(user.id);
  return { user, tokens };
}

export async function loginUser(input: { account: string; password: string }) {
  const user = await db.user.findFirst({
    where: {
      OR: [{ email: input.account }, { username: input.account }],
    },
    select: { id: true, email: true, username: true, passwordHash: true },
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new Error('Invalid credentials');
  }

  const { passwordHash: _, ...safeUser } = user;
  const tokens = await issueSession(user.id);
  return { user: safeUser, tokens };
}

async function issueSession(userId: string) {
  const env = getEnv();
  const accessToken = await signAccessToken(userId, env.JWT_ACCESS_SECRET);
  const refreshToken = await signRefreshToken(userId, env.JWT_REFRESH_SECRET);
  await db.userSession.create({
    data: {
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: addDays(new Date(), 30),
    },
  });
  return { accessToken, refreshToken };
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
```

```ts
// cloudflaresub-next/apps/api/src/modules/auth/auth.routes.ts
import type { FastifyInstance } from 'fastify';
import { loginSchema, registerSchema } from '@cloudflaresub/shared';
import { createUser, loginUser } from './auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const input = registerSchema.parse(request.body);
    const result = await createUser(input);
    return reply.status(201).send(result);
  });

  app.post('/login', async (request) => {
    const input = loginSchema.parse(request.body);
    return loginUser(input);
  });
}
```

- [ ] **Step 4: Add API runtime config and DB wiring**

```ts
// cloudflaresub-next/apps/api/src/lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PUBLIC_BASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url().optional(),
});

let _env: z.infer<typeof envSchema> | undefined;

export function getEnv() {
  if (!_env) {
    _env = envSchema.parse(process.env);
  }
  return _env;
}
```

```ts
// cloudflaresub-next/apps/api/src/lib/db.ts
import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();
```

- [ ] **Step 5: Re-run the auth test until it passes**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/api test -- auth.integration.test.ts`

Expected: PASS with registration and login working against a local test database.

- [ ] **Step 6: Commit the auth module**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add apps/api
git commit -m "实现认证与会话基础能力"
```

## Task 5: Implement Dataset CRUD With User Isolation

**Files:**
- Create: `cloudflaresub-next/apps/api/src/plugins/require-user.ts`
- Create: `cloudflaresub-next/apps/api/src/modules/sources/source.repository.ts`
- Create: `cloudflaresub-next/apps/api/src/modules/sources/source.routes.ts`
- Create: `cloudflaresub-next/apps/api/tests/sources.integration.test.ts`
- Modify: `cloudflaresub-next/apps/api/src/app.ts`

- [ ] **Step 1: Write the failing dataset isolation test**

```ts
// cloudflaresub-next/apps/api/tests/sources.integration.test.ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

async function createTwoUsers(server: any) {
  const regA = await request(server)
    .post('/auth/register')
    .send({ email: 'userA@example.com', password: 'password-a-long' });
  const regB = await request(server)
    .post('/auth/register')
    .send({ email: 'userB@example.com', password: 'password-b-long' });
  return {
    tokenA: regA.body.tokens.accessToken as string,
    tokenB: regB.body.tokens.accessToken as string,
  };
}

describe('source datasets', () => {
  it('isolates datasets by authenticated user', async () => {
    const app = buildApp();
    await app.ready();

    // Helper should register two users and extract two access tokens.
    const { tokenA, tokenB } = await createTwoUsers(app.server);

    const createResponse = await request(app.server)
      .post('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`)
      .send({
        name: '机场A',
        content: 'vmess://demo'
      });

    expect(createResponse.status).toBe(201);

    const listA = await request(app.server)
      .get('/sources/node-links')
      .set('authorization', `Bearer ${tokenA}`);
    const listB = await request(app.server)
      .get('/sources/node-links')
      .set('authorization', `Bearer ${tokenB}`);

    expect(listA.body.items).toHaveLength(1);
    expect(listB.body.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the dataset test and verify it fails**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/api test -- sources.integration.test.ts`

Expected: FAIL because bearer auth and `/sources/*` routes do not exist yet.

- [ ] **Step 3: Add a user-auth plugin and dataset repository**

```ts
// cloudflaresub-next/apps/api/src/plugins/require-user.ts
import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken } from '../lib/auth.js';
import { getEnv } from '../lib/env.js';

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({ message: 'Unauthorized' });
  }

  try {
    const payload = await verifyAccessToken(header.slice(7), getEnv().JWT_ACCESS_SECRET);
    (request as any).user = { id: payload.sub };
  } catch {
    return reply.status(401).send({ message: 'Unauthorized' });
  }
}
```

```ts
// cloudflaresub-next/apps/api/src/modules/sources/source.repository.ts
import { db } from '../../lib/db';

export function listNodeLinkSets(userId: string) {
  return db.nodeLinkSet.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' }
  });
}

export function createNodeLinkSet(userId: string, input: { name: string; description?: string; content: string }) {
  return db.nodeLinkSet.create({
    data: { userId, ...input }
  });
}

export function softDeleteNodeLinkSet(userId: string, id: string) {
  return db.nodeLinkSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() }
  });
}

export function listPreferredAddressSets(userId: string) {
  return db.preferredAddressSet.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: 'desc' }
  });
}

export function createPreferredAddressSet(userId: string, input: { name: string; description?: string; content: string }) {
  return db.preferredAddressSet.create({
    data: { userId, ...input }
  });
}

export function softDeletePreferredAddressSet(userId: string, id: string) {
  return db.preferredAddressSet.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() }
  });
}
```

- [ ] **Step 4: Register CRUD routes for both dataset types**

```ts
// cloudflaresub-next/apps/api/src/modules/sources/source.routes.ts
import type { FastifyInstance } from 'fastify';
import { datasetSchema } from '@cloudflaresub/shared';
import { requireUser } from '../../plugins/require-user.js';
import {
  listNodeLinkSets,
  createNodeLinkSet,
  softDeleteNodeLinkSet,
  listPreferredAddressSets,
  createPreferredAddressSet,
  softDeletePreferredAddressSet,
} from './source.repository.js';

export async function sourceRoutes(app: FastifyInstance) {
  app.get('/node-links', { preHandler: requireUser }, async (request) => {
    return { items: await listNodeLinkSets(request.user.id) };
  });

  app.post('/node-links', { preHandler: requireUser }, async (request, reply) => {
    const input = datasetSchema.parse(request.body);
    const item = await createNodeLinkSet(request.user.id, input);
    return reply.status(201).send(item);
  });

  app.delete('/node-links/:id', { preHandler: requireUser }, async (request, reply) => {
    await softDeleteNodeLinkSet(request.user.id, (request.params as { id: string }).id);
    return reply.status(204).send();
  });

  app.get('/preferred-addresses', { preHandler: requireUser }, async (request) => {
    return { items: await listPreferredAddressSets(request.user.id) };
  });

  app.post('/preferred-addresses', { preHandler: requireUser }, async (request, reply) => {
    const input = datasetSchema.parse(request.body);
    const item = await createPreferredAddressSet(request.user.id, input);
    return reply.status(201).send(item);
  });

  app.delete('/preferred-addresses/:id', { preHandler: requireUser }, async (request, reply) => {
    await softDeletePreferredAddressSet(request.user.id, (request.params as { id: string }).id);
    return reply.status(204).send();
  });
}
```

```ts
// cloudflaresub-next/apps/api/src/app.ts — add after authRoutes import
import { sourceRoutes } from './modules/sources/source.routes.js';

// add after app.register(authRoutes, ...)
app.register(sourceRoutes, { prefix: '/sources' });
```

- [ ] **Step 5: Re-run the dataset isolation tests**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/api test -- sources.integration.test.ts`

Expected: PASS with soft-delete semantics and per-user isolation enforced.

- [ ] **Step 6: Commit dataset CRUD**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add apps/api
git commit -m "实现数据集管理接口"
```

## Task 6: Implement Preview Generation, Publishing, Public Access, And Restore

**Files:**
- Create: `cloudflaresub-next/apps/api/src/modules/generator/generator.service.ts`
- Create: `cloudflaresub-next/apps/api/src/modules/generator/generator.routes.ts`
- Create: `cloudflaresub-next/apps/api/src/modules/subscriptions/subscription.service.ts`
- Create: `cloudflaresub-next/apps/api/src/modules/subscriptions/subscription.routes.ts`
- Create: `cloudflaresub-next/apps/api/tests/subscriptions.integration.test.ts`
- Modify: `cloudflaresub-next/apps/api/src/app.ts`

- [ ] **Step 1: Write the failing generation and publish tests**

```ts
// cloudflaresub-next/apps/api/tests/subscriptions.integration.test.ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

const SAMPLE_VMESS =
  'vmess://ewogICJ2IjogIjIiLAogICJwcyI6ICJkZW1vLXdzLXRscyIsCiAgImFkZCI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAicG9ydCI6ICI0NDMiLAogICJpZCI6ICIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDEiLAogICJzY3kiOiAiYXV0byIsCiAgIm5ldCI6ICJ3cyIsCiAgInRscyI6ICJ0bHMiLAogICJwYXRoIjogIi93cyIsCiAgImhvc3QiOiAiZWRnZS5leGFtcGxlLmNvbSIsCiAgInNuaSI6ICJlZGdlLmV4YW1wbGUuY29tIiwKICAiZnAiOiAiY2hyb21lIiwKICAiYWxwbiI6ICJoMixodHRwLzEuMSIKfQ==';

async function createUserAndLogin(server: any) {
  const reg = await request(server)
    .post('/auth/register')
    .send({ email: 'subuser@example.com', password: 'strong-password' });
  return { accessToken: reg.body.tokens.accessToken as string };
}

describe('preview and subscriptions', () => {
  it('previews nodes, publishes a subscription, serves it publicly, and restores input state', async () => {
    const app = buildApp();
    await app.ready();
    const { accessToken } = await createUserAndLogin(app.server);

    const previewResponse = await request(app.server)
      .post('/generator/preview')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true
      });

    expect(previewResponse.status).toBe(200);
    expect(previewResponse.body.nodes).toHaveLength(1);

    const publishResponse = await request(app.server)
      .post('/subscriptions')
      .set('authorization', `Bearer ${accessToken}`)
      .send({
        nodeLinksInput: SAMPLE_VMESS,
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true,
        previewNodes: previewResponse.body.nodes,
        remark: '测试订阅',
        expiresAt: '2030-01-01T00:00:00.000Z',
        subscriptionType: 'clash'
      });

    expect(publishResponse.status).toBe(201);
    expect(publishResponse.body.publicUrl).toContain('/subscriptions/public/');

    const publicResponse = await request(app.server).get(
      `/subscriptions/public/${publishResponse.body.publicToken}`
    );
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.text).toContain('proxies:');

    const restoreResponse = await request(app.server)
      .post(`/subscriptions/${publishResponse.body.subscription.id}/restore`)
      .set('authorization', `Bearer ${accessToken}`);

    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body.nodeLinksInput).toContain('vmess://');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/api test -- subscriptions.integration.test.ts`

Expected: FAIL because preview, publish, public access, and restore routes do not exist yet.

- [ ] **Step 3: Implement preview generation by calling `@cloudflaresub/sub-core`**

```ts
// cloudflaresub-next/apps/api/src/modules/generator/generator.service.ts
import { expandNodes, parseNodeLinks, parsePreferredAddresses } from '@cloudflaresub/sub-core';

export function previewSubscription(input: {
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix?: string;
  keepOriginalHost: boolean;
}) {
  const parsedNodes = parseNodeLinks(input.nodeLinksInput);
  const parsedAddresses = parsePreferredAddresses(input.preferredAddressesInput);
  const expanded = expandNodes(parsedNodes.nodes, parsedAddresses.endpoints, {
    namePrefix: input.namePrefix,
    keepOriginalHost: input.keepOriginalHost
  });

  return {
    warnings: [...parsedNodes.warnings, ...parsedAddresses.warnings, ...expanded.warnings],
    nodes: expanded.nodes
  };
}
```

```ts
// cloudflaresub-next/apps/api/src/modules/generator/generator.routes.ts
import { FastifyInstance } from 'fastify';
import { previewRequestSchema } from '@cloudflaresub/shared';
import { requireUser } from '../../plugins/require-user';
import { previewSubscription } from './generator.service';

export async function generatorRoutes(app: FastifyInstance) {
  app.post('/preview', { preHandler: requireUser }, async (request) => {
    const input = previewRequestSchema.parse(request.body);
    return previewSubscription(input);
  });
}
```

- [ ] **Step 4: Implement publish, list, details, delete, public access, and restore**

```ts
// cloudflaresub-next/apps/api/src/modules/subscriptions/subscription.service.ts
import crypto from 'node:crypto';
import { renderSubscription, type ParsedNode, type SubscriptionTarget } from '@cloudflaresub/sub-core';
import { db } from '../../lib/db.js';

interface PublishSubscriptionInput {
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix?: string;
  keepOriginalHost: boolean;
  previewNodes: ParsedNode[];
  remark: string;
  expiresAt: string;
  subscriptionType: SubscriptionTarget;
  publicBaseUrl: string;
}

export async function createSubscription(userId: string, input: PublishSubscriptionInput) {
  const rendered = renderSubscription(input.subscriptionType, input.previewNodes, input.publicBaseUrl);
  const publicToken = crypto.randomBytes(24).toString('hex');

  return db.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: {
        userId,
        remark: input.remark,
        subscriptionType: input.subscriptionType,
        publicToken,
        expiresAt: new Date(input.expiresAt)
      }
    });

    await tx.subscriptionSnapshot.create({
      data: {
        subscriptionId: subscription.id,
        userId,
        nodeLinkSetId: input.nodeLinkSetId,
        preferredAddressSetId: input.preferredAddressSetId,
        nodeLinksInput: input.nodeLinksInput,
        preferredAddressesInput: input.preferredAddressesInput,
        generatorOptions: {
          namePrefix: input.namePrefix,
          keepOriginalHost: input.keepOriginalHost
        },
        previewNodesJson: input.previewNodes,
        renderedContent: rendered.body,
        renderedContentEncoding: input.subscriptionType === 'clash' || input.subscriptionType === 'surge' ? 'plain' : 'base64'
      }
    });

    return { subscription, publicToken, rendered };
  });
}

export function findPublicSubscription(publicToken: string) {
  return db.subscription.findUnique({ where: { publicToken } });
}

export async function findLatestSnapshot(subscriptionId: string) {
  const snapshot = await db.subscriptionSnapshot.findFirst({
    where: { subscriptionId },
    orderBy: { createdAt: 'desc' }
  });

  if (!snapshot) {
    throw new Error('Snapshot not found');
  }

  return {
    renderedContent: snapshot.renderedContent,
    contentType: snapshot.renderedContentEncoding === 'plain'
      ? 'text/plain; charset=utf-8'
      : 'text/plain; charset=utf-8'
  };
}
```

```ts
// cloudflaresub-next/apps/api/src/modules/subscriptions/subscription.routes.ts
import type { FastifyInstance } from 'fastify';
import { publishSubscriptionSchema } from '@cloudflaresub/shared';
import { requireUser } from '../../plugins/require-user.js';
import { createSubscription, findPublicSubscription, findLatestSnapshot } from './subscription.service.js';

export async function subscriptionRoutes(app: FastifyInstance) {
  app.post('/', { preHandler: requireUser }, async (request, reply) => {
    const input = publishSubscriptionSchema.parse(request.body);
    const result = await createSubscription(request.user.id, {
      ...input,
      publicBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:4000'
    });

    return reply.status(201).send({
      subscription: result.subscription,
      publicToken: result.publicToken,
      publicUrl: `${process.env.API_BASE_URL}/subscriptions/public/${result.publicToken}`
    });
  });

  app.get('/public/:token', async (request, reply) => {
    const token = (request.params as { token: string }).token;
    const subscription = await findPublicSubscription(token);

    if (!subscription || subscription.expiresAt < new Date() || subscription.deletedAt) {
      return reply.status(410).send({ message: 'Subscription expired' });
    }

    const snapshot = await findLatestSnapshot(subscription.id);
    return reply.type(snapshot.contentType).send(snapshot.renderedContent);
  });
}
```

```ts
// cloudflaresub-next/apps/api/src/app.ts — add after sourceRoutes import
import { generatorRoutes } from './modules/generator/generator.routes.js';
import { subscriptionRoutes } from './modules/subscriptions/subscription.routes.js';

// add after app.register(sourceRoutes, ...)
app.register(generatorRoutes, { prefix: '/generator' });
app.register(subscriptionRoutes, { prefix: '/subscriptions' });
```

- [ ] **Step 5: Re-run the subscription integration tests**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/api test -- subscriptions.integration.test.ts`

Expected: PASS with preview, publish, public fetch, and restore all green.

- [ ] **Step 6: Commit the generation and subscription APIs**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add apps/api
git commit -m "实现预览生成与订阅发布接口"
```

## Task 7: Build The Web Shell, Auth Pages, And Shared Layout

**Files:**
- Create: `cloudflaresub-next/apps/web/tsconfig.json`
- Create: `cloudflaresub-next/apps/web/vite.config.ts`
- Create: `cloudflaresub-next/apps/web/index.html`
- Create: `cloudflaresub-next/apps/web/src/main.tsx`
- Create: `cloudflaresub-next/apps/web/src/app/router.tsx`
- Create: `cloudflaresub-next/apps/web/src/app/query-client.ts`
- Create: `cloudflaresub-next/apps/web/src/app/auth-store.ts`
- Create: `cloudflaresub-next/apps/web/src/routes/login-page.tsx`
- Create: `cloudflaresub-next/apps/web/src/routes/register-page.tsx`
- Create: `cloudflaresub-next/apps/web/src/routes/app-shell.tsx`
- Create: `cloudflaresub-next/apps/web/src/routes/__tests__/auth-shell.test.tsx`

- [ ] **Step 1: Write the failing auth-shell test**

```tsx
// cloudflaresub-next/apps/web/src/routes/__tests__/auth-shell.test.tsx
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from '../../app/router';

describe('app shell', () => {
  it('renders top navigation for authenticated pages', () => {
    const router = createMemoryRouter(routes, {
      initialEntries: ['/']
    });

    render(<RouterProvider router={router} />);

    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '数据管理' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the web shell test and verify it fails**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/web test -- auth-shell.test.tsx`

Expected: FAIL because the Vite app, routes, and shell components do not exist yet.

- [ ] **Step 3: Build the React app shell and auth pages**

```tsx
// cloudflaresub-next/apps/web/src/routes/app-shell.tsx
import { NavLink, Outlet } from 'react-router-dom';

export function AppShell() {
  return (
    <div>
      <header>
        <nav>
          <NavLink to="/">首页</NavLink>
          <NavLink to="/data">数据管理</NavLink>
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
```

```tsx
// cloudflaresub-next/apps/web/src/routes/login-page.tsx
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export function LoginPage() {
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account, password })
    });

    if (!response.ok) {
      setError('登录失败');
      return;
    }

    navigate('/');
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>账号<input value={account} onChange={(event) => setAccount(event.target.value)} /></label>
      <label>密码<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error ? <p role="alert">{error}</p> : null}
      <button type="submit">登录</button>
      <Link to="/register">注册</Link>
    </form>
  );
}
```

```tsx
// cloudflaresub-next/apps/web/src/routes/register-page.tsx
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '' });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form)
    });

    if (response.ok) {
      navigate('/');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>邮箱<input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
      <label>用户名<input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
      <label>密码<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
      <button type="submit">注册</button>
    </form>
  );
}
```

- [ ] **Step 4: Wire routing and query state**

```tsx
// cloudflaresub-next/apps/web/src/app/router.tsx
import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../routes/app-shell';
import { LoginPage } from '../routes/login-page';
import { RegisterPage } from '../routes/register-page';
import { HomePage } from '../routes/home-page';
import { DataPage } from '../routes/data-page';

export const routes = [
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'data/*', element: <DataPage /> }
    ]
  }
];

export const router = createBrowserRouter(routes);
```

- [ ] **Step 5: Re-run the shell test**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/web test -- auth-shell.test.tsx`

Expected: PASS with the lightweight shell visible.

- [ ] **Step 6: Commit the web shell**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add apps/web
git commit -m "搭建前端壳层与认证页面"
```

## Task 8: Implement The Homepage Tool Flow

**Files:**
- Create: `cloudflaresub-next/apps/web/src/routes/home-page.tsx`
- Create: `cloudflaresub-next/apps/web/src/features/home/api.ts`
- Create: `cloudflaresub-next/apps/web/src/features/home/home-state.ts`
- Create: `cloudflaresub-next/apps/web/src/routes/__tests__/home-page.test.tsx`

- [ ] **Step 1: Write the failing homepage flow test**

```tsx
// cloudflaresub-next/apps/web/src/routes/__tests__/home-page.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from '../home-page';

describe('home page', () => {
  it('previews nodes and publishes one subscription link', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        warnings: [],
        nodes: [
          { name: 'node-1', type: 'vmess', server: '104.16.1.2', port: 443, hostHeader: 'edge.example.com', sni: 'edge.example.com' }
        ]
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        publicUrl: 'http://localhost:4000/subscriptions/public/demo-token'
      })));

    render(<HomePage />);

    await userEvent.type(screen.getByLabelText('节点链接'), 'vmess://demo');
    await userEvent.type(screen.getByLabelText('优选地址'), '104.16.1.2#HK');
    await userEvent.click(screen.getByRole('button', { name: '生成节点' }));

    expect(await screen.findByText('node-1')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('订阅类型'), 'clash');
    await userEvent.type(screen.getByLabelText('备注'), '测试订阅');
    await userEvent.click(screen.getByRole('button', { name: '生成订阅' }));

    expect(await screen.findByDisplayValue('http://localhost:4000/subscriptions/public/demo-token')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the homepage test and verify it fails**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/web test -- home-page.test.tsx`

Expected: FAIL because `HomePage` and its fetch logic do not exist yet.

- [ ] **Step 3: Build the left-right homepage tool**

```tsx
// cloudflaresub-next/apps/web/src/routes/home-page.tsx
import { useState } from 'react';

export function HomePage() {
  const [nodeLinksInput, setNodeLinksInput] = useState('');
  const [preferredAddressesInput, setPreferredAddressesInput] = useState('');
  const [namePrefix, setNamePrefix] = useState('');
  const [keepOriginalHost, setKeepOriginalHost] = useState(true);
  const [nodes, setNodes] = useState<any[]>([]);

  return (
    <div className="home-layout">
      <section>
        <label>节点链接<textarea aria-label="节点链接" value={nodeLinksInput} onChange={(event) => setNodeLinksInput(event.target.value)} /></label>
        <label>优选地址<textarea aria-label="优选地址" value={preferredAddressesInput} onChange={(event) => setPreferredAddressesInput(event.target.value)} /></label>
        <label>名称前缀<input value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} /></label>
        <label><input type="checkbox" checked={keepOriginalHost} onChange={(event) => setKeepOriginalHost(event.target.checked)} />保留原始 Host/SNI</label>
        <button type="button">生成节点</button>
      </section>
      <section>
        {nodes.map((node) => (
          <article key={node.name}>
            <strong>{node.name}</strong>
            <button type="button">删除</button>
          </article>
        ))}
        <label>订阅类型<select aria-label="订阅类型"><option value="clash">Clash</option><option value="v2rayn">V2rayN</option><option value="shadowrocket">Shadowrocket</option><option value="surge">Surge</option></select></label>
        <label>备注<input aria-label="备注" /></label>
        <button type="button">生成订阅</button>
      </section>
    </div>
  );
}
```

```ts
// cloudflaresub-next/apps/web/src/features/home/api.ts
export async function previewNodes(payload: PreviewRequest) {
  const response = await fetch('/api/generator/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}

export async function publishSubscription(payload: PublishSubscriptionRequest) {
  const response = await fetch('/api/subscriptions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return response.json();
}
```

- [ ] **Step 4: Re-run the homepage flow test**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/web test -- home-page.test.tsx`

Expected: PASS with preview and publish flow working from one page.

- [ ] **Step 5: Commit the homepage tool**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add apps/web
git commit -m "实现首页工具流"
```

## Task 9: Implement Data Management Screens And Restore Flow

**Files:**
- Create: `cloudflaresub-next/apps/web/src/routes/data-page.tsx`
- Create: `cloudflaresub-next/apps/web/src/routes/node-link-page.tsx`
- Create: `cloudflaresub-next/apps/web/src/routes/preferred-address-page.tsx`
- Create: `cloudflaresub-next/apps/web/src/routes/subscription-management-page.tsx`
- Create: `cloudflaresub-next/apps/web/src/routes/__tests__/data-management.test.tsx`

- [ ] **Step 1: Write the failing data-management test**

```tsx
// cloudflaresub-next/apps/web/src/routes/__tests__/data-management.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SubscriptionManagementPage } from '../subscription-management-page';

describe('subscription management', () => {
  it('shows details and triggers restore', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({
        items: [
          {
            id: 'sub-1',
            remark: '测试订阅',
            subscriptionType: 'clash',
            createdAt: '2026-05-15T00:00:00.000Z',
            expiresAt: '2030-01-01T00:00:00.000Z'
          }
        ]
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        nodeLinksInput: 'vmess://demo',
        preferredAddressesInput: '104.16.1.2#HK',
        namePrefix: 'CF',
        keepOriginalHost: true
      })));

    render(<SubscriptionManagementPage />);

    expect(await screen.findByText('测试订阅')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '恢复' }));

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/subscriptions/sub-1/restore'),
      expect.any(Object)
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/web test -- data-management.test.tsx`

Expected: FAIL because the data pages and restore action do not exist yet.

- [ ] **Step 3: Build the three lightweight management screens**

```tsx
// cloudflaresub-next/apps/web/src/routes/data-page.tsx
import { NavLink, Outlet } from 'react-router-dom';

export function DataPage() {
  return (
    <div>
      <nav>
        <NavLink to="/data/node-links">节点链接</NavLink>
        <NavLink to="/data/preferred-addresses">优选地址</NavLink>
        <NavLink to="/data/subscriptions">订阅管理</NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
```

```tsx
// cloudflaresub-next/apps/web/src/routes/subscription-management-page.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

export function SubscriptionManagementPage() {
  const [items, setItems] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/api/subscriptions')
      .then((response) => response.json())
      .then((body) => setItems(body.items ?? []));
  }, []);

  async function handleRestore(id: string) {
    const response = await fetch(`/api/subscriptions/${id}/restore`, { method: 'POST' });
    const payload = await response.json();
    navigate('/', { state: payload });
  }

  return (
    <table>
      <tbody>
        {items.map((item) => (
          <tr key={item.id}>
            <td>{item.remark}</td>
            <td>{item.subscriptionType}</td>
            <td><button type="button">详情</button></td>
            <td><button type="button">复制</button></td>
            <td><button type="button">删除</button></td>
            <td><button type="button" onClick={() => handleRestore(item.id)}>恢复</button></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```tsx
// cloudflaresub-next/apps/web/src/routes/node-link-page.tsx
export function NodeLinkPage() {
  return (
    <section>
      <h2>节点链接</h2>
      <button type="button">新增节点链接</button>
      <div data-testid="node-link-list" />
    </section>
  );
}
```

```tsx
// cloudflaresub-next/apps/web/src/routes/preferred-address-page.tsx
export function PreferredAddressPage() {
  return (
    <section>
      <h2>优选地址</h2>
      <button type="button">新增优选地址</button>
      <div data-testid="preferred-address-list" />
    </section>
  );
}
```

- [ ] **Step 4: Re-run the data-management test**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm --filter @cloudflaresub/web test -- data-management.test.tsx`

Expected: PASS with the restore call and management shell in place.

- [ ] **Step 5: Commit data management**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add apps/web
git commit -m "实现数据管理与恢复流"
```

## Task 10: Add Local Deployment, Verification, And Docs

**Files:**
- Create: `cloudflaresub-next/deploy/docker-compose.yml`
- Create: `cloudflaresub-next/apps/api/Dockerfile`
- Create: `cloudflaresub-next/apps/web/Dockerfile`
- Modify: `cloudflaresub-next/README.md`

- [ ] **Step 1: Write a failing deployment smoke checklist as documentation**

```md
<!-- cloudflaresub-next/README.md -->
## Verification checklist

- register a user
- create one node-link dataset
- create one preferred-address dataset
- generate preview nodes from the homepage
- publish one Clash subscription
- open the public URL without login
- restore the subscription back to the homepage
```

- [ ] **Step 2: Add Dockerfiles and Compose runtime definitions**

```dockerfile
# cloudflaresub-next/apps/api/Dockerfile
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @cloudflaresub/api build
CMD ["pnpm", "dev:api"]
```

```dockerfile
# cloudflaresub-next/apps/web/Dockerfile
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm --filter @cloudflaresub/web build
CMD ["pnpm", "dev:web"]
```

```yaml
# cloudflaresub-next/deploy/docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: cloudflaresub_next
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
  api:
    build:
      context: ..
      dockerfile: apps/api/Dockerfile
    env_file:
      - ../.env
    ports:
      - "4000:4000"
    depends_on:
      - postgres
  web:
    build:
      context: ..
      dockerfile: apps/web/Dockerfile
    env_file:
      - ../.env
    ports:
      - "3000:3000"
    depends_on:
      - api
```

- [ ] **Step 3: Run the full verification suite**

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next && pnpm test`

Expected: PASS across `@cloudflaresub/sub-core`, `@cloudflaresub/shared`, `@cloudflaresub/api`, and `@cloudflaresub/web`.

Run: `cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next/deploy && docker compose up --build`

Expected: web on `http://localhost:3000`, api on `http://localhost:4000`, postgres on `localhost:5432`.

- [ ] **Step 4: Commit deployment support and docs**

```bash
cd /mnt/d/wanwan/project/self/proxy/cloudflaresub-next
git add deploy README.md apps/api/Dockerfile apps/web/Dockerfile
git commit -m "补齐部署与验证说明"
```
