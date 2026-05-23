import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  loadHomeDraft,
  saveHomeDraft,
  type HomeDraft,
  type HomeDraftPreviewNode,
} from '../app/home-draft.js';
import { listDatasets, type DatasetItem } from '../features/data-management/api.js';
import { previewNodes, publishSubscription } from '../features/home/api.js';
import { HomeDatasetSourceSection } from './home-dataset-source-section.js';

type PreviewNode = HomeDraftPreviewNode;

interface RestoreState {
  nodeLinkSetIds?: string[];
  preferredAddressSetIds?: string[];
  nodeLinksInput?: string;
  preferredAddressesInput?: string;
  namePrefix?: string;
  keepOriginalHost?: boolean;
  previewNodes?: PreviewNode[];
  requiresRegenerate?: boolean;
}

function normalizeSelectedIds(ids?: string[]) {
  return Array.isArray(ids) ? ids.filter((item) => item.trim()) : [];
}

function updateSelectedIds(current: string[], id: string, checked: boolean) {
  if (checked) {
    return current.includes(id) ? current : [...current, id];
  }

  return current.filter((item) => item !== id);
}

function getNonEmptyLines(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function countDatasetLines(ids: string[], datasets: DatasetItem[]) {
  const selectedSet = new Set(ids);

  return datasets
    .filter((item) => selectedSet.has(item.id))
    .reduce((total, item) => total + getNonEmptyLines(item.content).length, 0);
}

function toggleExpandedId(current: string[], id: string) {
  return current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
}

function getTagClass(type: string) {
  const t = type.toLowerCase();
  if (t.includes('vmess')) return 'tag-vmess';
  if (t.includes('vless')) return 'tag-vless';
  if (t.includes('trojan')) return 'tag-trojan';
  return '';
}

export function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const restoreState = (location.state as RestoreState | null) ?? null;
  const baseDraft = loadHomeDraft();
  const initialDraft: HomeDraft = {
    ...baseDraft,
    ...(restoreState?.nodeLinkSetIds ? { nodeLinkSetIds: normalizeSelectedIds(restoreState.nodeLinkSetIds) } : {}),
    ...(restoreState?.preferredAddressSetIds ? { preferredAddressSetIds: normalizeSelectedIds(restoreState.preferredAddressSetIds) } : {}),
    ...(restoreState?.nodeLinksInput !== undefined ? { nodeLinksInput: restoreState.nodeLinksInput } : {}),
    ...(restoreState?.preferredAddressesInput !== undefined ? { preferredAddressesInput: restoreState.preferredAddressesInput } : {}),
    ...(restoreState?.namePrefix !== undefined ? { namePrefix: restoreState.namePrefix } : {}),
    ...(restoreState?.keepOriginalHost !== undefined ? { keepOriginalHost: restoreState.keepOriginalHost } : {}),
    ...(restoreState?.previewNodes !== undefined ? { previewNodes: restoreState.previewNodes } : {}),
    ...(restoreState?.requiresRegenerate !== undefined ? { requiresRegenerate: restoreState.requiresRegenerate } : {}),
  };
  const [nodeDatasets, setNodeDatasets] = useState<DatasetItem[]>([]);
  const [preferredDatasets, setPreferredDatasets] = useState<DatasetItem[]>([]);
  const [nodeLinkSetIds, setNodeLinkSetIds] = useState<string[]>(initialDraft.nodeLinkSetIds ?? []);
  const [preferredAddressSetIds, setPreferredAddressSetIds] = useState<string[]>(initialDraft.preferredAddressSetIds ?? []);
  const [nodeLinksInput, setNodeLinksInput] = useState(initialDraft.nodeLinksInput);
  const [preferredAddressesInput, setPreferredAddressesInput] = useState(initialDraft.preferredAddressesInput);
  const [expandedNodeDatasetIds, setExpandedNodeDatasetIds] = useState<string[]>([]);
  const [expandedPreferredDatasetIds, setExpandedPreferredDatasetIds] = useState<string[]>([]);
  const [namePrefix, setNamePrefix] = useState(initialDraft.namePrefix);
  const [keepOriginalHost, setKeepOriginalHost] = useState(initialDraft.keepOriginalHost);
  const [nodes, setNodes] = useState<PreviewNode[]>(initialDraft.previewNodes);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [subscriptionType, setSubscriptionType] = useState<'clash' | 'v2rayn' | 'shadowrocket' | 'surge'>(initialDraft.subscriptionType);
  const [remark, setRemark] = useState(initialDraft.remark);
  const [publicUrl, setPublicUrl] = useState('');
  const [showResultModal, setShowResultModal] = useState(false);
  const [requiresRegenerate, setRequiresRegenerate] = useState(initialDraft.requiresRegenerate);
  const expiresAt = useMemo(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), []);

  const preferredCount = useMemo(
    () => getNonEmptyLines(preferredAddressesInput).length + countDatasetLines(preferredAddressSetIds, preferredDatasets),
    [preferredAddressesInput, preferredAddressSetIds, preferredDatasets],
  );

  useEffect(() => {
    void Promise.all([
      listDatasets('node-links'),
      listDatasets('preferred-addresses'),
    ]).then(([nodePayload, preferredPayload]) => {
      setNodeDatasets(nodePayload.items ?? []);
      setPreferredDatasets(preferredPayload.items ?? []);
    }).catch(() => {
      setNodeDatasets([]);
      setPreferredDatasets([]);
    });
  }, []);

  useEffect(() => {
    saveHomeDraft({
      nodeLinkSetIds,
      preferredAddressSetIds,
      nodeLinksInput,
      preferredAddressesInput,
      namePrefix,
      keepOriginalHost,
      previewNodes: nodes,
      warnings,
      subscriptionType,
      remark,
      requiresRegenerate,
    });
  }, [
    nodeLinkSetIds,
    preferredAddressSetIds,
    nodeLinksInput,
    preferredAddressesInput,
    namePrefix,
    keepOriginalHost,
    nodes,
    warnings,
    subscriptionType,
    remark,
    requiresRegenerate,
  ]);

  async function handlePreview() {
    const payload = await previewNodes({
      ...(nodeLinkSetIds.length ? { nodeLinkSetIds } : {}),
      ...(preferredAddressSetIds.length ? { preferredAddressSetIds } : {}),
      nodeLinksInput,
      preferredAddressesInput,
      keepOriginalHost,
      ...(namePrefix ? { namePrefix } : {}),
    });
    setWarnings(payload.warnings ?? []);
    setNodes(((payload.nodes ?? []) as unknown) as PreviewNode[]);
    setRequiresRegenerate(false);
  }

  async function handlePublish() {
    const normalizedRemark = remark.trim();
    const payload = await publishSubscription({
      ...(nodeLinkSetIds.length ? { nodeLinkSetIds } : {}),
      ...(preferredAddressSetIds.length ? { preferredAddressSetIds } : {}),
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
    setShowResultModal(true);
  }

  function closeResultModal() {
    setShowResultModal(false);
  }

  function clearGeneratedState() {
    setNodes([]);
    setWarnings([]);
    setPublicUrl('');
  }

  function toggleNodeDataset(id: string, checked: boolean) {
    setNodeLinkSetIds((current) => updateSelectedIds(current, id, checked));
    clearGeneratedState();
  }

  function togglePreferredDataset(id: string, checked: boolean) {
    setPreferredAddressSetIds((current) => updateSelectedIds(current, id, checked));
    clearGeneratedState();
  }

  async function handleCopyUrl() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
  }

  return (
    <div className="main-grid">
      <section className="panel">
        <div className="panel-title">输入配置</div>
        <HomeDatasetSourceSection
          sourceLabel="节点链接来源"
          sourceAriaLabel="节点链接来源"
          emptyText="暂无可选数据集，直接在下方粘贴即可。"
          manualLabel="节点链接"
          textareaId="node-links"
          textareaValue={nodeLinksInput}
          textareaRows={6}
          textareaPlaceholder="vmess://... vless://... trojan://...&#10;一行一个，支持 base64 订阅内容"
          datasets={nodeDatasets}
          selectedIds={nodeLinkSetIds}
          expandedIds={expandedNodeDatasetIds}
          onToggleSelected={toggleNodeDataset}
          onToggleExpanded={(id) => setExpandedNodeDatasetIds((current) => toggleExpandedId(current, id))}
          onTextareaChange={setNodeLinksInput}
        />
        <HomeDatasetSourceSection
          sourceLabel="优选地址来源"
          sourceAriaLabel="优选地址来源"
          emptyText="暂无可选数据集，直接在下方粘贴即可。"
          manualLabel="优选地址"
          textareaId="preferred-addresses"
          textareaValue={preferredAddressesInput}
          textareaRows={4}
          textareaPlaceholder="104.16.1.2#HK&#10;104.17.2.3:2053#US"
          datasets={preferredDatasets}
          selectedIds={preferredAddressSetIds}
          expandedIds={expandedPreferredDatasetIds}
          onToggleSelected={togglePreferredDataset}
          onToggleExpanded={(id) => setExpandedPreferredDatasetIds((current) => toggleExpandedId(current, id))}
          onTextareaChange={setPreferredAddressesInput}
        />
        <div className="row">
          <div>
            <label htmlFor="name-prefix">备注前缀</label>
            <input id="name-prefix" type="text" placeholder="例如 CF" value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} />
          </div>
          <label className="checkbox" style={{ marginBottom: 6 }}>
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
        {requiresRegenerate ? (
          <p className="text-muted">已从历史订阅恢复输入，请重新生成节点后再发布。</p>
        ) : null}
        {warnings.length ? (
          <div className="warning-list">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        <div className="stats">
          <div className="stat"><div className="num">{nodes.length}</div><div className="lbl">生成节点</div></div>
          <div className="stat"><div className="num">{preferredCount}</div><div className="lbl">优选地址</div></div>
          <div className="stat"><div className="num">{nodes.length}</div><div className="lbl">输出总数</div></div>
        </div>
        <div className="node-list">
          {nodes.map((node) => (
            <article key={node.name} className="node-item">
              <div>
                <span className="name">{node.name}</span>
                {node.type ? <span className={`tag ${getTagClass(node.type)}`}>{node.type}</span> : null}
                <span className="meta">
                  {node.server}:{node.port}
                  {node.hostHeader ? ` · Host: ${node.hostHeader}` : ''}
                  {node.sni ? ` · SNI: ${node.sni}` : ''}
                </span>
              </div>
              <button type="button" className="del" onClick={() => setNodes(nodes.filter((item) => item.name !== node.name))}>
                删除
              </button>
            </article>
          ))}
        </div>
        <div className="expire-row">
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
            <input id="remark" type="text" aria-label="备注" placeholder="给这个订阅起个名字" value={remark} onChange={(event) => setRemark(event.target.value)} />
          </div>
        </div>
        <div className="actions-row">
          <button type="button" className="btn btn-primary" onClick={handlePublish} disabled={requiresRegenerate || nodes.length === 0}>
            生成订阅
          </button>
        </div>
      </section>

      {showResultModal && publicUrl ? (
        <div className="modal-overlay" role="presentation" onClick={closeResultModal}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="result-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="result-modal-title">订阅链接</h3>
              <button type="button" className="modal-close" onClick={closeResultModal} aria-label="关闭">&times;</button>
            </div>
            <div className="modal-body">
              <div className="result-box">
                <input readOnly value={publicUrl} aria-label="订阅链接" />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCopyUrl}>复制</button>
              <button type="button" className="btn btn-primary" onClick={() => navigate('/data/subscriptions')}>订阅管理</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
