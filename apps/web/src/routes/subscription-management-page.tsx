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

  return (
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
      {detail ? (
        <div className="panel detail-panel">
          <div className="panel-title">订阅详情</div>
          {detail.subscription.publicUrl ? <p>{detail.subscription.publicUrl}</p> : null}
          <pre>{detail.snapshot.nodeLinksInput}</pre>
          <pre>{detail.snapshot.preferredAddressesInput}</pre>
        </div>
      ) : null}
    </div>
  );
}
