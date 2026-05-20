import { apiJson } from '../../app/api-client.js';

export interface PreviewRequest {
  nodeLinkSetIds?: string[];
  preferredAddressSetIds?: string[];
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix?: string;
  keepOriginalHost: boolean;
}

export interface PublishSubscriptionRequest extends PreviewRequest {
  previewNodes: Array<Record<string, unknown>>;
  remark?: string;
  expiresAt: string;
  subscriptionType: 'clash' | 'v2rayn' | 'shadowrocket' | 'surge';
}

export async function previewNodes(payload: PreviewRequest) {
  return apiJson<{ warnings?: string[]; nodes?: Array<Record<string, unknown>> }>('/api/generator/preview', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function publishSubscription(payload: PublishSubscriptionRequest) {
  return apiJson<{ publicUrl?: string }>('/api/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
