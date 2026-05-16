import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSession } from '../app/auth-store.js';

interface SubscriptionItem {
  id: string;
  remark: string;
  subscriptionType: string;
  createdAt: string;
  expiresAt: string;
}

export function SubscriptionManagementPage() {
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const session = getSession();
    fetch('/api/subscriptions', {
      headers: session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {},
    })
      .then((response) => response.json())
      .then((body) => setItems(body.items ?? []));
  }, []);

  async function handleRestore(id: string) {
    const session = getSession();
    const response = await fetch(`/api/subscriptions/${id}/restore`, {
      method: 'POST',
      headers: session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {},
    });
    const payload = await response.json();
    navigate('/', { state: payload });
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
                <td className="td-actions">
                  <button type="button" className="btn btn-secondary btn-sm">
                    详情
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm">
                    复制
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRestore(item.id)}>
                    恢复
                  </button>
                  <button type="button" className="btn btn-danger btn-sm">
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
