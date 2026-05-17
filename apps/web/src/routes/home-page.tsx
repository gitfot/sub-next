import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { previewNodes, publishSubscription } from '../features/home/api.js';

interface PreviewNode {
  name: string;
  type: string;
  server: string;
  port: number;
  hostHeader?: string;
  sni?: string;
}

interface RestoreState {
  nodeLinksInput?: string;
  preferredAddressesInput?: string;
  namePrefix?: string;
  keepOriginalHost?: boolean;
  previewNodes?: PreviewNode[];
}

export function HomePage() {
  const location = useLocation();
  const restoreState = (location.state as RestoreState | null) ?? null;
  const [nodeLinksInput, setNodeLinksInput] = useState(restoreState?.nodeLinksInput ?? '');
  const [preferredAddressesInput, setPreferredAddressesInput] = useState(restoreState?.preferredAddressesInput ?? '');
  const [namePrefix, setNamePrefix] = useState(restoreState?.namePrefix ?? '');
  const [keepOriginalHost, setKeepOriginalHost] = useState(restoreState?.keepOriginalHost ?? true);
  const [nodes, setNodes] = useState<PreviewNode[]>(restoreState?.previewNodes ?? []);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [subscriptionType, setSubscriptionType] = useState<'clash' | 'v2rayn' | 'shadowrocket' | 'surge'>('clash');
  const [remark, setRemark] = useState('');
  const [publicUrl, setPublicUrl] = useState('');
  const expiresAt = useMemo(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), []);

  async function handlePreview() {
    const payload = await previewNodes({
      nodeLinksInput,
      preferredAddressesInput,
      keepOriginalHost,
      ...(namePrefix ? { namePrefix } : {}),
    });
    setWarnings(payload.warnings ?? []);
    setNodes(payload.nodes ?? []);
  }

  async function handlePublish() {
    const normalizedRemark = remark.trim();
    const payload = await publishSubscription({
      nodeLinksInput,
      preferredAddressesInput,
      keepOriginalHost,
      previewNodes: nodes as unknown as Array<Record<string, unknown>>,
      expiresAt,
      subscriptionType,
      ...(normalizedRemark ? { remark: normalizedRemark } : {}),
      ...(namePrefix ? { namePrefix } : {}),
    });
    setPublicUrl(payload.publicUrl ?? '');
  }

  return (
    <div className="home-layout">
      <section className="panel">
        <div className="panel-title">输入配置</div>
        <div>
          <label htmlFor="node-links">节点链接</label>
          <textarea
            id="node-links"
            aria-label="节点链接"
            value={nodeLinksInput}
            onChange={(event) => setNodeLinksInput(event.target.value)}
          />
        </div>
        <div>
          <label htmlFor="preferred-addresses">优选地址</label>
          <textarea
            id="preferred-addresses"
            aria-label="优选地址"
            value={preferredAddressesInput}
            onChange={(event) => setPreferredAddressesInput(event.target.value)}
          />
        </div>
        <div className="row">
          <div>
            <label htmlFor="name-prefix">备注前缀</label>
            <input id="name-prefix" value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={keepOriginalHost} onChange={(event) => setKeepOriginalHost(event.target.checked)} />
            保留原 Host/SNI
          </label>
        </div>
        <div className="actions-row">
          <button type="button" className="btn btn-primary" onClick={handlePreview}>
            生成节点
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">生成结果</div>
        {warnings.length ? (
          <div className="warning-list">
            {warnings.map((warning) => (
              <p key={warning} className="text-muted">
                {warning}
              </p>
            ))}
          </div>
        ) : null}
        <div className="node-list">
          {nodes.map((node) => (
            <article key={node.name} className="node-item">
              <div>
                <div className="name">{node.name}</div>
                <div className="meta">
                  {node.server}:{node.port}
                  {node.hostHeader ? ` · Host: ${node.hostHeader}` : ''}
                  {node.sni ? ` · SNI: ${node.sni}` : ''}
                </div>
              </div>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => setNodes(nodes.filter((item) => item.name !== node.name))}>
                删除
              </button>
            </article>
          ))}
        </div>
        <div className="row">
          <div>
            <label htmlFor="subscription-type">订阅类型</label>
            <select
              id="subscription-type"
              aria-label="订阅类型"
              value={subscriptionType}
              onChange={(event) => setSubscriptionType(event.target.value as typeof subscriptionType)}
            >
              <option value="clash">Clash</option>
              <option value="v2rayn">V2rayN</option>
              <option value="shadowrocket">Shadowrocket</option>
              <option value="surge">Surge</option>
            </select>
          </div>
          <div>
            <label htmlFor="remark">备注</label>
            <input id="remark" aria-label="备注" value={remark} onChange={(event) => setRemark(event.target.value)} />
          </div>
        </div>
        <div className="actions-row">
          <button type="button" className="btn btn-primary" onClick={handlePublish}>
            生成订阅
          </button>
        </div>
        {publicUrl ? (
          <div className="result-box">
            <input readOnly value={publicUrl} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
