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
  if (Number.isInteger(num) && num >= 1 && num <= 65535) {
    return num;
  }
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(`端口无效：${value}`);
}

export function normalizeInteger(value: string | number | undefined, fallback = 0): number {
  const num = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(num) ? num : fallback;
}

export function normalizePath(value: string | undefined): string {
  const text = String(value ?? '').trim();
  if (!text) {
    return '/';
  }
  return text.startsWith('/') ? text : `/${text}`;
}

export function splitListValue(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value ?? '')
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
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
  if (!raw) {
    return '';
  }
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function formatHostForUrl(host: string): string {
  if (String(host).includes(':') && !String(host).startsWith('[')) {
    return `[${host}]`;
  }
  return host;
}

export function yamlQuote(value: string | number): string {
  const text = String(value ?? '');
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function sanitizeSurgeName(name: string): string {
  return String(name || 'proxy')
    .replace(/[\r\n]/g, ' ')
    .replace(/,/g, '，')
    .replace(/=/g, '＝')
    .trim();
}

export function escapeSurgeHeader(value: string): string {
  return String(value ?? '').replace(/"/g, '\\"');
}

export function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function encodeBase64Utf8(text: string): string {
  return Buffer.from(text, 'utf-8').toString('base64');
}

export function decodeBase64Utf8(base64Text: string): string {
  return Buffer.from(normalizeBase64(base64Text), 'base64').toString('utf-8');
}

function normalizeBase64(input: string): string {
  const value = String(input ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padding = value.length % 4 === 0 ? '' : '='.repeat(4 - (value.length % 4));
  return value + padding;
}
