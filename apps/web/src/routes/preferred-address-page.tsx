import { useEffect, useState } from 'react';
import { createDataset, deleteDataset, listDatasets, updateDataset, type DatasetItem } from '../features/data-management/api.js';

interface DatasetFormState {
  id?: string;
  name: string;
  description: string;
  content: string;
}

const emptyForm: DatasetFormState = {
  name: '',
  description: '',
  content: '',
};

export function PreferredAddressPage() {
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<DatasetFormState>(emptyForm);

  async function refresh() {
    const payload = await listDatasets('preferred-addresses');
    setItems(payload.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      content: form.content.trim(),
    };

    if (form.id) {
      await updateDataset('preferred-addresses', form.id, payload);
    } else {
      await createDataset('preferred-addresses', payload);
    }

    setForm(emptyForm);
    setIsEditing(false);
    await refresh();
  }

  function handleEdit(item: DatasetItem) {
    setForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      content: item.content,
    });
    setIsEditing(true);
  }

  async function handleDelete(id: string) {
    await deleteDataset('preferred-addresses', id);
    await refresh();
  }

  return (
    <div className="panel">
      <div className="panel-title-row">
        <div className="panel-title">优选地址</div>
        <button type="button" className="btn btn-primary" onClick={() => { setForm(emptyForm); setIsEditing(true); }}>
          新增优选地址
        </button>
      </div>
      {isEditing ? (
        <div className="panel-form">
          <label>
            名称
            <input aria-label="名称" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label>
            描述
            <input aria-label="描述" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </label>
          <label>
            内容
            <textarea aria-label="内容" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
          </label>
          <div className="actions-row">
            <button type="button" className="btn btn-primary" onClick={handleSubmit}>
              保存
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { setForm(emptyForm); setIsEditing(false); }}>
              取消
            </button>
          </div>
        </div>
      ) : null}
      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>更新时间</th>
                <th>内容摘要</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.updatedAt ?? ''}</td>
                  <td>{item.content.slice(0, 60)}</td>
                  <td className="td-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleEdit(item)}>
                      编辑
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
      ) : (
        <div className="empty-state">
          <p>暂无优选地址数据集。</p>
        </div>
      )}
    </div>
  );
}
