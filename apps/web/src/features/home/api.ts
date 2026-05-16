import { getSession } from '../../app/auth-store.js';

export interface PreviewRequest {
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix?: string;
  keepOriginalHost: boolean;
}

export interface PublishSubscriptionRequest extends PreviewRequest {
  previewNodes: Array<Record<string, unknown>>;
  remark: string;
  expiresAt: string;
  subscriptionType: 'clash' | 'v2rayn' | 'shadowrocket' | 'surge';
}

function buildHeaders() {
  const session = getSession();
  return {
    'content-type': 'application/json',
    ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}),
  };
}

export async function previewNodes(payload: PreviewRequest) {
  const response = await fetch('/api/generator/preview', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  return response.json();
}

export async function publishSubscription(payload: PublishSubscriptionRequest) {
  const response = await fetch('/api/subscriptions', {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(payload),
  });
  return response.json();
}
