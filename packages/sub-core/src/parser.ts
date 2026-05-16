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
  const lines = normalizedInput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
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
      if (seen.has(dedupeKey)) {
        return;
      }
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
  if (!text || text.includes('://')) {
    return text;
  }
  if (!/^[A-Za-z0-9+/=_-]+$/.test(text)) {
    return text;
  }
  try {
    const decoded = decodeBase64Utf8(text);
    if (decoded.includes('://')) {
      return decoded;
    }
  } catch {
    // Ignore malformed base64 and return the original text.
  }
  return text;
}

function parseSingleNode(uri: string): ParsedNode {
  const lower = uri.toLowerCase();
  if (lower.startsWith('vmess://')) {
    return parseVmessUri(uri);
  }
  if (lower.startsWith('vless://')) {
    return parseVlessUri(uri);
  }
  if (lower.startsWith('trojan://')) {
    return parseTrojanUri(uri);
  }
  throw new Error('只支持 vmess://、vless://、trojan://');
}

function parseEndpoint(rawLine: string): PreferredAddress {
  const raw = String(rawLine).trim();
  if (!raw) {
    throw new Error('优选地址为空');
  }
  const hashIndex = raw.indexOf('#');
  const hostPart = hashIndex >= 0 ? raw.slice(0, hashIndex).trim() : raw;
  const label = hashIndex >= 0 ? raw.slice(hashIndex + 1).trim() : '';
  const { host, port } = splitHostAndPort(hostPart);
  if (!host) {
    throw new Error(`无效地址：${raw}`);
  }
  return {
    host,
    ...(port !== undefined ? { port } : {}),
    ...(label ? { label } : {}),
  };
}

function splitHostAndPort(input: string): { host: string; port?: number } {
  const value = String(input).trim();
  if (!value) {
    return { host: '' };
  }
  if (value.startsWith('[')) {
    const match = value.match(/^\[([^\]]+)](?::(\d+))?$/);
    if (!match) {
      throw new Error(`IPv6 地址格式错误：${value}`);
    }
    const port = match[2] ? normalizePort(match[2]) : undefined;
    return {
      host: match[1]!,
      ...(port !== undefined ? { port } : {}),
    };
  }
  const colonCount = (value.match(/:/g) ?? []).length;
  if (colonCount > 1) {
    return { host: value };
  }
  const parts = value.split(':');
  if (parts.length === 2 && /^\d+$/.test(parts[1]!)) {
    return { host: parts[0]!, port: normalizePort(parts[1]!) };
  }
  return { host: value };
}

function parseVmessUri(uri: string): ParsedNode {
  const encoded = uri.slice('vmess://'.length).trim();
  const jsonText = decodeBase64Utf8(encoded);
  const data = JSON.parse(jsonText) as Record<string, string | number | undefined>;
  const server = String(data.add ?? '').trim();
  const port = normalizePort(data.port, 443);
  const uuid = String(data.id ?? '').trim();
  if (!server || !uuid) {
    throw new Error('VMess 链接缺少 add 或 id');
  }

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
    path: normalizePath(String(data.path || '/')),
    hostHeader: String(data.host ?? '').trim(),
    sni: String(data.sni ?? '').trim(),
    tls: isTlsEnabled(String(data.tls ?? '')),
    security: String(data.tls ?? '').trim(),
    alpn: splitListValue(String(data.alpn ?? '')),
    fp: String(data.fp ?? '').trim(),
    headerType: String(data.type ?? '').trim(),
    allowInsecure: toBoolean(String(data.allowInsecure ?? '')),
    params: {},
  };
}

function parseVlessUri(uri: string): ParsedNode {
  const url = new URL(uri);
  const params = Object.fromEntries(url.searchParams.entries());
  const server = url.hostname;
  const port = normalizePort(url.port || params.port, 443);
  const uuid = decodeURIComponent(url.username || '').trim();
  if (!server || !uuid) {
    throw new Error('VLESS 链接缺少主机或 UUID');
  }

  const network = String(params.type || 'tcp').trim() || 'tcp';
  const security = String(params.security ?? '').trim();
  return {
    type: 'vless',
    name: decodeHashName(url.hash) || 'vless',
    server,
    originalServer: server,
    port,
    uuid,
    network,
    path: normalizePath(params.path ?? ''),
    hostHeader: String(params.host ?? '').trim(),
    sni: String(params.sni || params.peer || '').trim(),
    tls: security === 'tls' || security === 'reality',
    security,
    alpn: splitListValue(params.alpn),
    fp: String(params.fp ?? '').trim(),
    allowInsecure: toBoolean(params.allowInsecure || params.insecure),
    flow: String(params.flow ?? '').trim(),
    serviceName: String(params.serviceName ?? '').trim(),
    authority: String(params.authority ?? '').trim(),
    encryption: String(params.encryption || 'none').trim() || 'none',
    params,
  };
}

function parseTrojanUri(uri: string): ParsedNode {
  const url = new URL(uri);
  const params = Object.fromEntries(url.searchParams.entries());
  const server = url.hostname;
  const port = normalizePort(url.port || params.port, 443);
  const password = decodeURIComponent(url.username || '').trim();
  if (!server || !password) {
    throw new Error('Trojan 链接缺少主机或密码');
  }

  const security = String(params.security || 'tls').trim() || 'tls';
  return {
    type: 'trojan',
    name: decodeHashName(url.hash) || 'trojan',
    server,
    originalServer: server,
    port,
    password,
    network: String(params.type || 'tcp').trim() || 'tcp',
    path: normalizePath(params.path ?? ''),
    hostHeader: String(params.host ?? '').trim(),
    sni: String(params.sni || params.peer || '').trim(),
    tls: security === 'tls',
    security,
    alpn: splitListValue(params.alpn),
    fp: String(params.fp ?? '').trim(),
    allowInsecure: toBoolean(params.allowInsecure || params.insecure),
    serviceName: String(params.serviceName ?? '').trim(),
    authority: String(params.authority ?? '').trim(),
    params,
  };
}
