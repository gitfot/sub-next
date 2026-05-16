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
