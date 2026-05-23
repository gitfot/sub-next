import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteSubscription,
  getSubscriptionDetail,
  listDatasets,
  listSubscriptions,
  restoreSubscription,
  type DatasetItem,
  type SubscriptionDetail,
  type SubscriptionListItem,
} from '../features/data-management/api.js';

function formatDateTime(value?: string) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

function getTypeBadgeClass(type: string) {
  return 'badge-blue';
}

function getStatusBadge(status?: string) {
  if (!status || status === 'active') return { label: '有效', cls: 'badge-green' };
  if (status === 'expired') return { label: '已过期', cls: 'badge-red' };
  return { label: status, cls: 'badge-yellow' };
}

export function SubscriptionManagementPage() {
  const [items, setItems] = useState<SubscriptionListItem[]>([]);
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [nodeDatasets, setNodeDatasets] = useState<DatasetItem[]>([]);
  const [preferredDatasets, setPreferredDatasets] = useState<DatasetItem[]>([]);
  const navigate = useNavigate();

  async function refresh() {
    const body = await listSubscriptions();
    setItems(body.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

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
    if (!detail) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDetail(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [detail]);

  async function handleDetail(id: string) {
    setDetail(await getSubscriptionDetail(id));
  }

  async function handleCopy(publicUrl?: string) {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
  }

  async function handleRestore(id: string) {
    const payload = await restoreSubscription(id);
    navigate('/', { state: payload, replace: true });
  }

  async function handleDelete(id: string) {
    await deleteSubscription(id);
    await refresh();
  }

  const previewNodeNames = (detail?.snapshot.previewNodes ?? []).map((node, index) => {
    if (typeof node.name === 'string' && node.name.trim()) return node.name;
    return `节点 ${index + 1}`;
  });
  const nodeDatasetNameMap = new Map(nodeDatasets.map((item) => [item.id, item.name]));
  const preferredDatasetNameMap = new Map(preferredDatasets.map((item) => [item.id, item.name]));
  const selectedNodeSourceNames = (detail?.snapshot.nodeLinkSetIds ?? []).map((id) => nodeDatasetNameMap.get(id) ?? id);
  const selectedPreferredSourceNames = (detail?.snapshot.preferredAddressSetIds ?? []).map((id) => preferredDatasetNameMap.get(id) ?? id);

  return (
    <>
      <div className="data-page-body">
        <div className="panel-title">已发布订阅</div>

        {items.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>备注</th>
                  <th>类型</th>
                  <th>创建时间</th>
                  <th>有效期至</th>
                  <th>状态</th>
                  <th style={{ width: 200 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const status = getStatusBadge(item.status);
                  return (
                    <tr key={item.id}>
                      <td><strong>{item.remark}</strong></td>
                      <td><span className={`badge ${getTypeBadgeClass(item.subscriptionType)}`}>{item.subscriptionType}</span></td>
                      <td className="td-meta">{item.createdAt}</td>
                      <td className="td-meta">{item.expiresAt}</td>
                      <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                      <td className="td-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDetail(item.id)}>
                          详情
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRestore(item.id)}>
                          恢复
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                          删除
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <p>暂无已发布订阅。</p>
          </div>
        )}
      </div>

      {detail ? (
        <div className="modal-overlay" role="presentation" onClick={() => setDetail(null)}>
          <div className="modal" style={{ maxWidth: 640 }} role="dialog" aria-modal="true" aria-labelledby="subscription-detail-title" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3 id="subscription-detail-title">订阅详情</h3>
              <button type="button" className="modal-close" onClick={() => setDetail(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="col-2">
                <div>
                  <label htmlFor="subscription-detail-remark">备注</label>
                  <input id="subscription-detail-remark" type="text" value={detail.subscription.remark} readOnly />
                </div>
                <div>
                  <label htmlFor="subscription-detail-type">订阅类型</label>
                  <input id="subscription-detail-type" type="text" value={detail.subscription.subscriptionType} readOnly />
                </div>
              </div>
              <div className="col-2">
                <div>
                  <label htmlFor="subscription-detail-created-at">创建时间</label>
                  <input id="subscription-detail-created-at" type="text" value={formatDateTime(detail.subscription.createdAt)} readOnly />
                </div>
                <div>
                  <label htmlFor="subscription-detail-expires-at">有效期至</label>
                  <input id="subscription-detail-expires-at" type="text" value={formatDateTime(detail.subscription.expiresAt)} readOnly />
                </div>
              </div>
              {detail.subscription.publicUrl ? (
                <div>
                  <label htmlFor="subscription-detail-public-url">公共链接</label>
                  <div className="result-box">
                    <input id="subscription-detail-public-url" type="text" value={detail.subscription.publicUrl} readOnly />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCopy(detail.subscription.publicUrl)}>复制</button>
                  </div>
                </div>
              ) : null}
              <label className="panel-subtitle" htmlFor="subscription-detail-node-sources">节点链接来源</label>
              <textarea id="subscription-detail-node-sources" rows={2} value={selectedNodeSourceNames.join('\n') || '-'} readOnly />
              <label className="panel-subtitle" htmlFor="subscription-detail-preferred-sources">优选地址来源</label>
              <textarea id="subscription-detail-preferred-sources" rows={2} value={selectedPreferredSourceNames.join('\n') || '-'} readOnly />
              <label className="panel-subtitle" htmlFor="subscription-detail-node-links-input">原始节点链接输入</label>
              <textarea id="subscription-detail-node-links-input" rows={3} value={detail.snapshot.nodeLinksInput || '-'} readOnly />
              <label className="panel-subtitle" htmlFor="subscription-detail-preferred-addresses-input">原始优选地址输入</label>
              <textarea id="subscription-detail-preferred-addresses-input" rows={3} value={detail.snapshot.preferredAddressesInput || '-'} readOnly />
              <div className="panel-subtitle">生成器选项</div>
              <div className="col-2">
                <div>
                  <label htmlFor="subscription-detail-name-prefix">备注前缀</label>
                  <input id="subscription-detail-name-prefix" type="text" value={detail.snapshot.namePrefix || '-'} readOnly />
                </div>
                <div>
                  <label htmlFor="subscription-detail-keep-original-host">保留原 Host/SNI</label>
                  <input id="subscription-detail-keep-original-host" type="text" value={detail.snapshot.keepOriginalHost ? '是' : '否'} readOnly />
                </div>
              </div>
              {previewNodeNames.length ? (
                <>
                  <div className="panel-subtitle">预览节点快照（{previewNodeNames.length} 个）</div>
                  <div className="node-list" style={{ maxHeight: 140 }}>
                    {previewNodeNames.map((name) => (
                      <div key={name} className="node-item">
                        <div><span className="name">{name}</span></div>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setDetail(null)}>关闭</button>
              <button type="button" className="btn btn-secondary" onClick={() => handleCopy(detail.subscription.publicUrl)}>复制链接</button>
              <button type="button" className="btn btn-primary" onClick={async () => { const payload = await restoreSubscription(detail.subscription.id); navigate('/', { state: payload, replace: true }); }}>恢复到首页</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
