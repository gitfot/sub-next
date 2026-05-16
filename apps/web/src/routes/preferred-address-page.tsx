import { useEffect, useState } from 'react';
import { getSession } from '../app/auth-store.js';

interface DatasetItem {
  id: string;
  name: string;
  description?: string | null;
  content: string;
}

export function PreferredAddressPage() {
  const [items, setItems] = useState<DatasetItem[]>([]);

  useEffect(() => {
    const session = getSession();
    fetch('/api/sources/preferred-addresses', {
      headers: session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {},
    })
      .then((response) => response.json())
      .then((payload) => setItems(payload.items ?? []))
      .catch(() => setItems([]));
  }, []);

  return (
    <div className="panel">
      <div className="panel-title">优选地址</div>
      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>内容摘要</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.content.slice(0, 60)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>优选地址数据集功能正在接入。</p>
        </div>
      )}
    </div>
  );
}
