import type { CatalogShell, EvaluatedCompositionNode } from '@battlegroup/core';
import type { RulesetRegistration } from '../../rulesets/types';

export interface MemberNode {
  node: EvaluatedCompositionNode;
  path: string[];
  label: string;
  children: MemberNode[];
}
export const samePath = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((part, index) => part === right[index]);
export const withinPath = (path: readonly string[], parent: readonly string[]) =>
  parent.every((part, index) => path[index] === part);
export const memberElementId = (selectionId: string, path: readonly string[]) =>
  'selection-' + selectionId + '-member-' + encodeURIComponent(JSON.stringify(path));

/** Omitted display wrappers retain their stable path in every descendant. */
export function memberTree(root: EvaluatedCompositionNode | undefined, catalog: CatalogShell, runtime: RulesetRegistration): MemberNode[] {
  const visit = (node: EvaluatedCompositionNode, path: string[]): MemberNode[] => {
    if (node.quantity <= 0) return [];
    const children = (node.children ?? []).flatMap(child => visit(child, [...path, child.nodeId]));
    const presentation = runtime.memberPresentation
      ? runtime.memberPresentation(node, catalog)
      : runtime.isMemberGroup(node) ? {label: node.nodeId.replaceAll('-', ' ')} : null;
    return presentation ? [{node, path, label: presentation.label, children}] : children;
  };
  return (root?.children ?? []).flatMap(child => visit(child, [child.nodeId]));
}
export function flattenMembers(members: readonly MemberNode[]): MemberNode[] {
  return members.flatMap(member => [member, ...flattenMembers(member.children)]);
}
export function memberAtPath(root: EvaluatedCompositionNode | undefined, path: readonly string[]) {
  let node = root;
  for (const id of path) node = node?.children?.find(child => child.nodeId === id);
  return node;
}
/** A target belongs to the deepest visible member that contains it. */
export function targetOwner(path: readonly string[], members: readonly MemberNode[]): string[] {
  return flattenMembers(members).filter(member => withinPath(path, member.path))
    .sort((left, right) => right.path.length - left.path.length)[0]?.path ?? [];
}
