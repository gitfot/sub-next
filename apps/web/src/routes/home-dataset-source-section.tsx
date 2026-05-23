import { type DatasetItem } from '../features/data-management/api.js';

const PREVIEW_LIMIT = 4;

function getNonEmptyLines(content: string) {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

interface HomeDatasetSourceSectionProps {
  sourceLabel: string;
  sourceAriaLabel: string;
  emptyText: string;
  manualLabel: string;
  textareaId: string;
  textareaValue: string;
  textareaRows: number;
  textareaPlaceholder: string;
  datasets: DatasetItem[];
  selectedIds: string[];
  expandedIds: string[];
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleExpanded: (id: string) => void;
  onTextareaChange: (value: string) => void;
}

export function HomeDatasetSourceSection(props: HomeDatasetSourceSectionProps) {
  return (
    <div className="home-source-section">
      <label>{props.sourceLabel}</label>
      <div className="dataset-cards" aria-label={props.sourceAriaLabel}>
        {props.datasets.length ? props.datasets.map((item) => {
          const lines = getNonEmptyLines(item.content);
          const previewLines = lines.slice(0, PREVIEW_LIMIT);
          const selected = props.selectedIds.includes(item.id);
          const expanded = props.expandedIds.includes(item.id);

          return (
            <article
              key={item.id}
              className={`dataset-card${selected ? ' selected' : ''}${expanded ? ' expanded' : ''}`}
            >
              <div className="dataset-card-header">
                <label className="checkbox dataset-card-checkbox">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={(event) => props.onToggleSelected(item.id, event.target.checked)}
                  />
                  <span className="name">{item.name}</span>
                </label>
                <span className="count">{lines.length} 条</span>
                <button
                  type="button"
                  className="expand-btn"
                  aria-expanded={expanded}
                  aria-label={`${expanded ? '收起' : '展开'} ${item.name} 预览`}
                  onClick={() => props.onToggleExpanded(item.id)}
                >
                  ▸
                </button>
              </div>
              {expanded ? (
                <div className="dataset-card-body">
                  <div className="preview-lines">
                    {previewLines.map((line, index) => (
                      <div key={`${item.id}-${index}`} className="line">{line}</div>
                    ))}
                  </div>
                  {lines.length > PREVIEW_LIMIT ? (
                    <div className="preview-more">还有 {lines.length - PREVIEW_LIMIT} 条...</div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        }) : (
          <p className="text-muted">{props.emptyText}</p>
        )}
      </div>
      <div className="manual-section">
        <label htmlFor={props.textareaId}>{props.manualLabel}</label>
        <textarea
          id={props.textareaId}
          aria-label={props.manualLabel}
          rows={props.textareaRows}
          placeholder={props.textareaPlaceholder}
          value={props.textareaValue}
          onChange={(event) => props.onTextareaChange(event.target.value)}
        />
        <p className="text-muted">此处内容与上方数据集完全独立，互不影响。</p>
      </div>
    </div>
  );
}
