import { type DatasetItem } from '../features/data-management/api.js';

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
  manualPlaceholder: string;
  datasets: DatasetItem[];
  selectedIds: string[];
  expandedIds: string[];
  datasetDraftEdits: Record<string, string>;
  manualInputs: string[];
  onToggleSelected: (id: string, checked: boolean) => void;
  onToggleExpanded: (id: string) => void;
  onDatasetContentChange: (id: string, value: string) => void;
  onAddManualInput: () => void;
  onManualInputChange: (index: number, value: string) => void;
  onRemoveManualInput: (index: number) => void;
}

export function HomeDatasetSourceSection(props: HomeDatasetSourceSectionProps) {
  return (
    <div className="home-source-section">
      <label>{props.sourceLabel}</label>
      <div className="dataset-cards" aria-label={props.sourceAriaLabel}>
        {props.datasets.length ? props.datasets.map((item) => {
          const currentContent = props.datasetDraftEdits[item.id] ?? item.content;
          const lines = getNonEmptyLines(currentContent);
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
                  <label className="sr-only" htmlFor={`dataset-content-${item.id}`}>编辑 {item.name} 内容</label>
                  <textarea
                    id={`dataset-content-${item.id}`}
                    className="dataset-content-editor"
                    aria-label={`编辑 ${item.name} 内容`}
                    rows={6}
                    value={currentContent}
                    onChange={(event) => props.onDatasetContentChange(item.id, event.target.value)}
                  />
                </div>
              ) : null}
            </article>
          );
        }) : (
          <p className="text-muted">{props.emptyText}</p>
        )}
      </div>
      <div className="manual-section">
        <div className="manual-section-header">
          <span>{props.manualLabel}</span>
          <button
            type="button"
            className="add-manual-btn"
            aria-label={`新增${props.manualLabel}输入`}
            onClick={props.onAddManualInput}
          >
            +
          </button>
        </div>
        {props.manualInputs.length ? (
          <div className="manual-input-list">
            {props.manualInputs.map((value, index) => (
              <div key={`${props.manualLabel}-${index}`} className="manual-input-row">
                <label className="sr-only" htmlFor={`${props.manualLabel}-${index}`}>{props.manualLabel} {index + 1}</label>
                <input
                  id={`${props.manualLabel}-${index}`}
                  type="text"
                  className="manual-line-input"
                  aria-label={`${props.manualLabel} ${index + 1}`}
                  placeholder={props.manualPlaceholder}
                  value={value}
                  onChange={(event) => props.onManualInputChange(index, event.target.value)}
                />
                <button
                  type="button"
                  className="remove-manual-btn"
                  aria-label={`删除${props.manualLabel} ${index + 1}`}
                  onClick={() => props.onRemoveManualInput(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
