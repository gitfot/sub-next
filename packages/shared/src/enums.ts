export const subscriptionTargets = ['v2rayn', 'clash', 'shadowrocket', 'surge'] as const;
export type SubscriptionTarget = (typeof subscriptionTargets)[number];
