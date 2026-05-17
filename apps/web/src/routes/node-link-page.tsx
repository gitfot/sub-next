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

export function NodeLinkPage() {
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState<DatasetFormState>(emptyForm);

  async function refresh() {
    const payload = await listDatasets('node-links');
    setItems(payload.items ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!isEditing) return undefined;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsEditing(false);
        setForm(emptyForm);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditing]);

  async function handleSubmit() {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      content: form.content.trim(),
    };

    if (form.id) {
      await updateDataset('node-links', form.id, payload);
    } else {
      await createDataset('node-links', payload);
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
    await deleteDataset('node-links', id);
    await refresh();
  }

  return (
    <div className="data-page-body">
      <div className="panel-header">
        <div className="panel-title">节点链接数据集</div>
        <button type="button" className="btn btn-primary" onClick={() => { setForm(emptyForm); setIsEditing(true); }}>
          + 新增节点链接
        </button>
      </div>

      {items.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名称</th>
                <th>内容摘要</th>
                <th>更新时间</th>
                <th style={{ width: 140 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.name}</strong></td>
                  <td className="td-meta text-mono">{item.content.slice(0, 60)}</td>
                  <td className="td-meta">{item.updatedAt ? new Date(item.updatedAt).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace('T', ' ') : ''}</td>
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
          <p>暂无节点链接数据集。</p>
        </div>
      )}

      {isEditing ? (
        <div className="modal-overlay" role="presentation" onClick={() => { setIsEditing(false); setForm(emptyForm); }}>
          <div className="modal" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{form.id ? '编辑节点链接数据集' : '新增节点链接数据集'}</h3>
              <button type="button" className="modal-close" onClick={() => { setIsEditing(false); setForm(emptyForm); }}>&times;</button>
            </div>
            <div className="modal-body">
              <div>
                <label>名称</label>
                <input type="text" placeholder="给数据集起个名字" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div>
                <label>描述（可选）</label>
                <input type="text" placeholder="简短描述用途" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </div>
              <div>
                <label>节点内容</label>
                <textarea rows={8} placeholder={'vmess://...\nvless://...\ntrojan://...\n一行一个'} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => { setIsEditing(false); setForm(emptyForm); }}>取消</button>
              <button type="button" className="btn btn-primary" onClick={handleSubmit}>保存</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
