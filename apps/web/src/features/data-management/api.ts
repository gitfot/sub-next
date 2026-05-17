import { apiFetch, apiJson } from '../../app/api-client.js';

export interface DatasetItem {
  id: string;
  name: string;
  description?: string | null;
  content: string;
  updatedAt?: string;
}

export async function listDatasets(kind: 'node-links' | 'preferred-addresses') {
  return apiJson<{ items: DatasetItem[] }>(`/api/sources/${kind}`);
}

export async function createDataset(
  kind: 'node-links' | 'preferred-addresses',
  payload: { name: string; description?: string; content: string },
) {
  return apiJson<DatasetItem>(`/api/sources/${kind}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDataset(
  kind: 'node-links' | 'preferred-addresses',
  id: string,
  payload: { name: string; description?: string; content: string },
) {
  return apiJson<DatasetItem>(`/api/sources/${kind}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteDataset(kind: 'node-links' | 'preferred-addresses', id: string) {
  return apiFetch(`/api/sources/${kind}/${id}`, {
    method: 'DELETE',
  });
}

export interface SubscriptionListItem {
  id: string;
  remark: string;
  subscriptionType: string;
  createdAt: string;
  expiresAt: string;
  status?: string;
  publicUrl?: string;
}

export interface SubscriptionDetail {
  subscription: SubscriptionListItem;
  snapshot: {
    nodeLinkSetId?: string;
    preferredAddressSetId?: string;
    nodeLinksInput: string;
    preferredAddressesInput: string;
    namePrefix: string;
    keepOriginalHost: boolean;
    previewNodes?: Array<Record<string, unknown>>;
  };
}

export interface RestorePayload {
  nodeLinkSetId?: string;
  preferredAddressSetId?: string;
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix: string;
  keepOriginalHost: boolean;
  previewNodes?: Array<Record<string, unknown>>;
  requiresRegenerate?: boolean;
  restoredFromSubscriptionId?: string;
}

export async function listSubscriptions() {
  return apiJson<{ items: SubscriptionListItem[] }>('/api/subscriptions');
}

export async function getSubscriptionDetail(id: string) {
  return apiJson<SubscriptionDetail>(`/api/subscriptions/${id}`);
}

export async function restoreSubscription(id: string) {
  return apiJson<RestorePayload>(`/api/subscriptions/${id}/restore`, {
    method: 'POST',
  });
}

export async function deleteSubscription(id: string) {
  return apiFetch(`/api/subscriptions/${id}`, {
    method: 'DELETE',
  });
}
