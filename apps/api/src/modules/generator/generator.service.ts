import { expandNodes, parseNodeLinks, parsePreferredAddresses } from 'sub-core';

export function previewSubscription(input: {
  nodeLinksInput: string;
  preferredAddressesInput: string;
  namePrefix?: string | undefined;
  keepOriginalHost: boolean;
}) {
  const parsedNodes = parseNodeLinks(input.nodeLinksInput);
  const parsedAddresses = parsePreferredAddresses(input.preferredAddressesInput);
  const expanded = expandNodes(parsedNodes.nodes, parsedAddresses.endpoints, {
    keepOriginalHost: input.keepOriginalHost,
    ...(input.namePrefix ? { namePrefix: input.namePrefix } : {}),
  });

  return {
    warnings: [...parsedNodes.warnings, ...parsedAddresses.warnings, ...expanded.warnings],
    nodes: expanded.nodes,
  };
}
