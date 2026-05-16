import type { PreferredAddress } from './parser.js';
import { deepClone } from './helpers.js';
import type { ParsedNode } from './types.js';

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
  options: ExpandOptions,
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
