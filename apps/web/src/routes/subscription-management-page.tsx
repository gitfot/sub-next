import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteSubscription,
  getSubscriptionDetail,
  listSubscriptions,
  restoreSubscription,
  type SubscriptionDetail,
  type SubscriptionListItem,
} from '../features/data-management/api.js';

function formatDateTime(value?: string) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString('zh-CN', { hour12: false });
}

export function SubscriptionManagementPage() {
  const [items, setItems] = useState<SubscriptionListItem[]>([]);
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const navigate = useNavigate();

  async function refresh() {
    const body = await listSubscriptions();
    setItems(body.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!detail) {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDetail(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [detail]);

  async function handleDetail(id: string) {
    setDetail(await getSubscriptionDetail(id));
  }

  async function handleCopy(publicUrl?: string) {
    if (!publicUrl) {
      return;
    }
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
    if (typeof node.name === 'string' && node.name.trim()) {
      return node.name;
    }
    return `节点 ${index + 1}`;
  });

  return (
    <>
      <div className="panel">
        <div className="panel-title">订阅管理</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>备注</th>
                <th>类型</th>
                <th>创建时间</th>
                <th>有效期至</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.remark}</td>
                  <td>{item.subscriptionType}</td>
                  <td>{item.createdAt}</td>
                  <td>{item.expiresAt}</td>
                  <td>{item.status ?? 'active'}</td>
                  <td className="td-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDetail(item.id)}>
                      详情
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleCopy(item.publicUrl)}>
                      复制
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRestore(item.id)}>
                      恢复
                    </button>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setDetail(null)}>
          <section
            className="modal subscription-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="subscription-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <div className="modal-eyebrow">历史订阅记录</div>
                <h2 id="subscription-detail-title" className="modal-title">
                  订阅详情
                </h2>
              </div>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDetail(null)}>
                关闭
              </button>
            </div>

            <div className="subscription-detail-hero">
              <div>
                <div className="subscription-detail-name">{detail.subscription.remark}</div>
                <div className="subscription-detail-subtitle">
                  {detail.subscription.subscriptionType}
                  {' · '}
                  {detail.subscription.status ?? 'active'}
                </div>
              </div>
              {detail.subscription.publicUrl ? (
                <div className="subscription-detail-url">
                  <span className="detail-label">公开链接</span>
                  <code>{detail.subscription.publicUrl}</code>
                </div>
              ) : null}
            </div>

            <div className="subscription-detail-grid">
              <div className="detail-card">
                <span className="detail-label">创建时间</span>
                <strong>{formatDateTime(detail.subscription.createdAt)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">有效期至</span>
                <strong>{formatDateTime(detail.subscription.expiresAt)}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">备注前缀</span>
                <strong>{detail.snapshot.namePrefix || '-'}</strong>
              </div>
              <div className="detail-card">
                <span className="detail-label">保留原 Host/SNI</span>
                <strong>{detail.snapshot.keepOriginalHost ? '是' : '否'}</strong>
              </div>
            </div>

            {previewNodeNames.length ? (
              <div className="detail-section">
                <div className="detail-section-header">
                  <h3>预览节点</h3>
                  <span>{previewNodeNames.length} 个</span>
                </div>
                <div className="detail-chip-list">
                  {previewNodeNames.map((name) => (
                    <span key={name} className="detail-chip">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="detail-section">
              <div className="detail-section-header">
                <h3>节点链接原文</h3>
              </div>
              <pre className="detail-code-block">{detail.snapshot.nodeLinksInput || '-'}</pre>
            </div>

            <div className="detail-section">
              <div className="detail-section-header">
                <h3>优选地址原文</h3>
              </div>
              <pre className="detail-code-block">{detail.snapshot.preferredAddressesInput || '-'}</pre>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
