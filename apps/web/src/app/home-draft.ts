export interface HomeDraftPreviewNode {
  name: string;
  type: string;
  server: string;
  port: number;
  hostHeader?: string;
  sni?: string;
}

export interface HomeDraft {
  nodeLinkSetIds: string[];
  preferredAddressSetIds: string[];
  nodeLinksInput: string;
  preferredAddressesInput: string;
  nodeLinkManualInputs: string[];
  preferredAddressManualInputs: string[];
  nodeDatasetDraftEdits: Record<string, string>;
  preferredDatasetDraftEdits: Record<string, string>;
  expandedNodeDatasetIds: string[];
  expandedPreferredDatasetIds: string[];
  namePrefix: string;
  keepOriginalHost: boolean;
  previewNodes: HomeDraftPreviewNode[];
  warnings: string[];
  subscriptionType: 'clash' | 'v2rayn' | 'shadowrocket' | 'surge';
  remark: string;
  requiresRegenerate: boolean;
}

export interface RestoreDraftInput {
  nodeLinkSetIds?: string[];
  preferredAddressSetIds?: string[];
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix: string;
  keepOriginalHost: boolean;
  previewNodes?: HomeDraftPreviewNode[];
  requiresRegenerate: boolean;
}

interface LegacyDraftShape {
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
  nodeLinkSetIds?: string[];
  preferredAddressSetIds?: string[];
  nodeLinkManualInputs?: string[];
  preferredAddressManualInputs?: string[];
}

function normalizeSelectedIds(value?: string[] | string) {
  if (Array.isArray(value)) {
    return value.filter((item) => item.trim());
  }
  if (typeof value === 'string' && value.trim()) {
    return [value];
  }
  return [];
}

function normalizeManualInputs(inputs?: string[], fallbackValue?: string) {
  if (Array.isArray(inputs)) {
    return inputs.filter((item) => item.trim());
  }

  if (typeof fallbackValue !== 'string' || !fallbackValue.trim()) {
    return [];
  }

  return fallbackValue
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

const STORAGE_KEY = 'sub-next-home-draft';

export function getEmptyHomeDraft(): HomeDraft {
  return {
    nodeLinkSetIds: [],
    preferredAddressSetIds: [],
    nodeLinksInput: '',
    preferredAddressesInput: '',
    nodeLinkManualInputs: [],
    preferredAddressManualInputs: [],
    nodeDatasetDraftEdits: {},
    preferredDatasetDraftEdits: {},
    expandedNodeDatasetIds: [],
    expandedPreferredDatasetIds: [],
    namePrefix: '',
    keepOriginalHost: true,
    previewNodes: [],
    warnings: [],
    subscriptionType: 'clash',
    remark: '',
    requiresRegenerate: false,
  };
}

export function loadHomeDraft(): HomeDraft {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return getEmptyHomeDraft();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<HomeDraft> & LegacyDraftShape;
    return {
      ...getEmptyHomeDraft(),
      ...parsed,
      nodeLinkSetIds: normalizeSelectedIds(parsed.nodeLinkSetIds ?? parsed.nodeLinkSetId),
      preferredAddressSetIds: normalizeSelectedIds(parsed.preferredAddressSetIds ?? parsed.preferredAddressSetId),
      nodeLinkManualInputs: normalizeManualInputs(parsed.nodeLinkManualInputs, parsed.nodeLinksInput),
      preferredAddressManualInputs: normalizeManualInputs(parsed.preferredAddressManualInputs, parsed.preferredAddressesInput),
      expandedNodeDatasetIds: normalizeSelectedIds(parsed.expandedNodeDatasetIds),
      expandedPreferredDatasetIds: normalizeSelectedIds(parsed.expandedPreferredDatasetIds),
    };
  } catch {
    return getEmptyHomeDraft();
  }
}

export function saveHomeDraft(draft: HomeDraft) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function saveHomeDraftFromRestore(restore: RestoreDraftInput) {
  saveHomeDraft({
    ...getEmptyHomeDraft(),
    nodeLinkSetIds: normalizeSelectedIds(restore.nodeLinkSetIds),
    preferredAddressSetIds: normalizeSelectedIds(restore.preferredAddressSetIds),
    nodeLinksInput: restore.nodeLinksInput,
    preferredAddressesInput: restore.preferredAddressesInput,
    nodeLinkManualInputs: normalizeManualInputs(undefined, restore.nodeLinksInput),
    preferredAddressManualInputs: normalizeManualInputs(undefined, restore.preferredAddressesInput),
    namePrefix: restore.namePrefix,
    keepOriginalHost: restore.keepOriginalHost,
    previewNodes: restore.previewNodes ?? [],
    requiresRegenerate: restore.requiresRegenerate,
  });
}
