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

const STORAGE_KEY = 'sub-next-home-draft';

export function getEmptyHomeDraft(): HomeDraft {
  return {
    nodeLinkSetIds: [],
    preferredAddressSetIds: [],
    nodeLinksInput: '',
    preferredAddressesInput: '',
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
    namePrefix: restore.namePrefix,
    keepOriginalHost: restore.keepOriginalHost,
    previewNodes: restore.previewNodes ?? [],
    requiresRegenerate: restore.requiresRegenerate,
  });
}
