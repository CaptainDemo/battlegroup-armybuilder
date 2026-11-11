import type { ArmySection } from '@battlegroup/core';

export interface SectionNode { section: ArmySection; children: SectionNode[] }
/** Catalog relations are validated before use. Preserve declared order at each level. */
export function sectionTree(sections: readonly ArmySection[]): SectionNode[] {
  const visit = (parent: string | null): SectionNode[] => sections
    .filter(section => section.parentSectionId === parent)
    .map(section => ({section, children: visit(section.sectionId)}));
  return visit(null);
}
export function descendantSectionIds(node: SectionNode): string[] {
  return [node.section.sectionId, ...node.children.flatMap(descendantSectionIds)];
}
