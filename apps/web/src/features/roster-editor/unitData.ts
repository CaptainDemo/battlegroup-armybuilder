import type { EvaluatedCompositionNode } from '@battlegroup/core';

/** Read the evaluated subtree so vehicle replacements and included quantities agree. */
export function collectUnitProfiles(
  node: EvaluatedCompositionNode,
  { excludeSubtrees = [], includeRoot = true }: {
    excludeSubtrees?: readonly EvaluatedCompositionNode[];
    includeRoot?: boolean;
  } = {},
): Array<{ profileLocalId: string; quantity: number }> {
  const quantities = new Map<string, number>();
  const excluded = new Set(excludeSubtrees);
  const visit = (member: EvaluatedCompositionNode, parentQuantity: number): void => {
    if (excluded.has(member)) return;
    const quantity = parentQuantity * member.quantity;
    if ((includeRoot || member !== node) && member.profileLocalId && quantity > 0) {
      quantities.set(member.profileLocalId, (quantities.get(member.profileLocalId) ?? 0) + quantity);
    }
    for (const child of member.children ?? []) visit(child, quantity);
  };
  visit(node, 1);
  return [...quantities].map(([profileLocalId, quantity]) => ({ profileLocalId, quantity }));
}
