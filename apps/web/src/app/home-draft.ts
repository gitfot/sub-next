export interface HomeDraftPreviewNode {
  name: string;
  type: string;
  server: string;
  port: number;
  hostHeader?: string;
  sni?: string;
}

export interface HomeDraft {
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
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
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix: string;
  keepOriginalHost: boolean;
  previewNodes?: HomeDraftPreviewNode[];
  requiresRegenerate: boolean;
}

const STORAGE_KEY = 'sub-next-home-draft';

export function getEmptyHomeDraft(): HomeDraft {
  return {
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
    return {
      ...getEmptyHomeDraft(),
      ...(JSON.parse(raw) as Partial<HomeDraft>),
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
    ...(restore.nodeLinkSetId ? { nodeLinkSetId: restore.nodeLinkSetId } : {}),
    ...(restore.preferredAddressSetId ? { preferredAddressSetId: restore.preferredAddressSetId } : {}),
    nodeLinksInput: restore.nodeLinksInput,
    preferredAddressesInput: restore.preferredAddressesInput,
    namePrefix: restore.namePrefix,
    keepOriginalHost: restore.keepOriginalHost,
    previewNodes: restore.previewNodes ?? [],
    requiresRegenerate: restore.requiresRegenerate,
  });
}
