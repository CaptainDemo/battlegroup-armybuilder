import { describe, expect, it } from 'vitest';
import type { CatalogShell } from './contracts/catalog';
import { validateCatalogRelations } from './validation/catalogRelations';
import { classicM01Catalog } from './samples/classicM01Catalog';
import { makeIsolationCatalog } from './samples/isolationCatalogs';

/**
 * Catalog relationship checks: identity and reference integrity that need
 * the whole explicit catalog. Each negative case asserts the specific
 * stable checkId so untested problems cannot hide behind a generic failure.
 */

function issuesFor(catalog: CatalogShell): string[] {
  return validateCatalogRelations(catalog).map((issue) => issue.checkId);
}

describe('source references resolve for every record kind', () => {
  it.each(['profile', 'option'] as const)('rejects an undeclared source on a %s', (kind) => {
    const catalog = structuredClone(classicM01Catalog);
    const record = kind === 'profile' ? catalog.profiles[0] : catalog.optionGroups[0]?.options[0];
    if (record === undefined) throw new Error('fixture record missing');
    record.sourceRefs = [{ documentId: 'missing-document', pdfPage: 1 }];
    expect(issuesFor(catalog)).toContain('catalog/source/document-unknown');
  });
});

describe('positive: real M01-facts catalog and synthetic isolation catalogs', () => {
  it('the M01 sample catalog is internally consistent', () => {
    expect(validateCatalogRelations(classicM01Catalog)).toEqual([]);
  });

  it('each synthetic isolation catalog validates standalone (no other ruleset needed)', () => {
    for (const rulesetId of ['classic-coldwar', 'airland', 'northag'] as const) {
      expect(issuesFor(makeIsolationCatalog(rulesetId)), rulesetId).toEqual([]);
    }
  });
});

describe('negative: duplicate ids, orphans and cycles', () => {
  it('rejects duplicate entry localIds', () => {
    const catalog = structuredClone(classicM01Catalog);
    const first = catalog.entries[0];
    if (first === undefined) throw new Error('fixture entry missing');
    catalog.entries.push(first);
    expect(issuesFor(catalog)).toContain('catalog/entry/duplicate-id');
  });

  it('rejects duplicate section ids', () => {
    const catalog = structuredClone(classicM01Catalog);
    const armyList = catalog.armyLists[0];
    if (armyList === undefined) throw new Error('fixture army list missing');
    const section = armyList.structure.sections[0];
    if (section === undefined) throw new Error('fixture section missing');
    armyList.structure.sections.push(section);
    expect(issuesFor(catalog)).toContain('catalog/section/duplicate-id');
  });

  it('rejects duplicate profile ids and duplicate composition node ids', () => {
    const duplicateProfile = structuredClone(classicM01Catalog);
    const profile = duplicateProfile.profiles[0];
    if (profile === undefined) throw new Error('fixture profile missing');
    duplicateProfile.profiles.push(profile);
    expect(issuesFor(duplicateProfile)).toContain('catalog/profile/duplicate-id');

    const duplicateNode = structuredClone(classicM01Catalog);
    const entry = duplicateNode.entries.find((candidate) => candidate.localId === 't72-platoon');
    if (entry === undefined || entry.composition.state !== 'known') throw new Error('fixture entry missing');
    entry.composition.root.children?.push({
      nodeId: 'ordinary-1',
      role: 'ordinary',
      profileLocalId: 't72a',
      quantity: 1,
    });
    expect(issuesFor(duplicateNode)).toContain('catalog/entry/duplicate-node-id');
  });

  it('rejects sections with unknown parents (orphans)', () => {
    const catalog = structuredClone(classicM01Catalog);
    const armyList = catalog.armyLists[0];
    if (armyList === undefined) throw new Error('fixture army list missing');
    const section = armyList.structure.sections[0];
    if (section === undefined) throw new Error('fixture section missing');
    section.parentSectionId = 'ghost-section';
    expect(issuesFor(catalog)).toContain('catalog/section/unknown-parent');
  });

  it('rejects parent cycles in the section tree', () => {
    const catalog = structuredClone(classicM01Catalog);
    const armyList = catalog.armyLists[0];
    if (armyList === undefined) throw new Error('fixture army list missing');
    armyList.structure.sections.push(
      { sectionId: 'section-a', name: 'A', parentSectionId: 'section-b', directlyPurchasable: true },
      { sectionId: 'section-b', name: 'B', parentSectionId: 'section-a', directlyPurchasable: true },
    );
    expect(issuesFor(catalog)).toContain('catalog/section/cycle');
  });
});

describe('negative: reference integrity', () => {
  it('rejects entries in unknown sections or army lists', () => {
    const catalog = structuredClone(classicM01Catalog);
    const entry = catalog.entries.find((candidate) => candidate.localId === 'fhq');
    if (entry === undefined) throw new Error('fixture entry missing');
    entry.sectionIds = ['ghost-section'];
    expect(issuesFor(catalog)).toContain('catalog/entry/unknown-section');

    const wrongList = structuredClone(classicM01Catalog);
    const entry2 = wrongList.entries.find((candidate) => candidate.localId === 'fhq');
    if (entry2 === undefined) throw new Error('fixture entry missing');
    entry2.armyListIds = ['ghost-list'];
    expect(issuesFor(wrongList)).toContain('catalog/entry/unknown-army-list');
  });

  it('rejects entries referencing unknown option groups', () => {
    const catalog = structuredClone(classicM01Catalog);
    const entry = catalog.entries.find((candidate) => candidate.localId === 't72-platoon');
    if (entry === undefined) throw new Error('fixture entry missing');
    entry.optionGroupIds = ['ghost-group'];
    expect(issuesFor(catalog)).toContain('catalog/entry/unknown-option-group');
  });

  it('rejects option member-slots that do not resolve in the entry composition', () => {
    const catalog = structuredClone(classicM01Catalog);
    const group = catalog.optionGroups.find((candidate) => candidate.localId === 't72-platoon-upgrades');
    const kmt = group?.options.find((option) => option.localId === 'kmt');
    if (kmt === undefined || kmt.target.kind !== 'member-slots') throw new Error('fixture option missing');
    kmt.target.nodePaths = [['ghost-tank']];
    expect(issuesFor(catalog)).toContain('catalog/option/member-path-unresolvable');
  });

  it('rejects scope selectors matching unknown profiles', () => {
    const catalog = structuredClone(classicM01Catalog);
    const group = catalog.optionGroups.find((candidate) => candidate.localId === 'bmp1-upgrades');
    const option = group?.options.find((candidate) => candidate.localId === 'all-bmp1-to-p');
    if (option === undefined || option.target.kind !== 'scope-selector') throw new Error('fixture option missing');
    option.target.matchProfileLocalIds = ['ghost-profile'];
    expect(issuesFor(catalog)).toContain('catalog/option/scope-selector-profile-unknown');
  });

  it('rejects model replacements referencing unknown profiles', () => {
    const catalog = structuredClone(classicM01Catalog);
    const group = catalog.optionGroups.find((candidate) => candidate.localId === 'ambulance-downgrade');
    const option = group?.options.find((candidate) => candidate.localId === 'heavy-truck');
    if (option === undefined) throw new Error('fixture option missing');
    option.effects = [{ kind: 'model-replacement', fromProfileLocalId: 'ural452', toProfileLocalId: 'ghost' }];
    expect(issuesFor(catalog)).toContain('catalog/option/effect-profile-unknown');
  });

  it('rejects prerequisites outside the same group', () => {
    const catalog = structuredClone(classicM01Catalog);
    const group = catalog.optionGroups.find((candidate) => candidate.localId === 't62-platoon-upgrades');
    const bastion = group?.options.find((option) => option.localId === 'one-bastion');
    if (bastion === undefined) throw new Error('fixture option missing');
    bastion.requires = ['platoon-to-b', 'not-in-group'];
    expect(issuesFor(catalog)).toContain('catalog/option/prerequisite-unknown');
  });

  it('rejects composition nodes referencing unknown profiles', () => {
    const catalog = structuredClone(classicM01Catalog);
    const entry = catalog.entries.find((candidate) => candidate.localId === 't72-platoon');
    if (entry === undefined || entry.composition.state !== 'known') throw new Error('fixture entry missing');
    const command = entry.composition.root.children?.[0];
    if (command === undefined) throw new Error('fixture node missing');
    command.profileLocalId = 'ghost-profile';
    expect(issuesFor(catalog)).toContain('catalog/composition/profile-unknown');
  });

  it('rejects source references to undeclared documents', () => {
    const catalog = structuredClone(classicM01Catalog);
    const entry = catalog.entries.find((candidate) => candidate.localId === 'fhq');
    if (entry === undefined) throw new Error('fixture entry missing');
    entry.sourceRefs = [{ documentId: 'ghost-doc', pdfPage: 1 }];
    expect(issuesFor(catalog)).toContain('catalog/source/document-unknown');
  });

  it('rejects applied errata targeting unknown records', () => {
    const catalog = structuredClone(classicM01Catalog);
    catalog.errataRecords = [
      {
        errataId: 'e1',
        targetRecordId: 'ghost-record',
        field: 'name',
        newValue: 'X',
        sourceRef: { documentId: 'SOV', pdfPage: 1 },
        status: 'applied',
      },
    ];
    expect(issuesFor(catalog)).toContain('catalog/errata/target-unknown');
  });

  it('rejects army lists declaring a different ruleset than the manifest', () => {
    const catalog = structuredClone(classicM01Catalog);
    const armyList = catalog.armyLists[0];
    if (armyList === undefined) throw new Error('fixture army list missing');
    armyList.rulesetId = 'northag';
    expect(issuesFor(catalog)).toContain('catalog/identity/ruleset-mismatch');
  });

  it('rejects formation-member grants with unresolvable member paths', () => {
    const catalog = structuredClone(classicM01Catalog);
    const entry = catalog.entries.find((candidate) => candidate.localId === 'bmp1-company');
    const grant = entry?.resourceGrants?.find((g) => g.scope === 'formation-member');
    if (entry === undefined || grant === undefined) throw new Error('fixture grant missing');
    grant.memberPath = ['ghost-platoon'];
    expect(issuesFor(catalog)).toContain('catalog/entry/grant-member-path-unresolvable');
  });
});

describe('rework additions: directlyPurchasable and composition additions', () => {
  it('rejects entries claiming purchase eligibility in non-directly-purchasable sections (R4)', () => {
    const catalog = structuredClone(classicM01Catalog);
    const armyList = catalog.armyLists[0];
    const tankSection = armyList?.structure.sections.find((section) => section.sectionId === 'tank');
    if (tankSection === undefined) throw new Error('fixture section missing');
    tankSection.directlyPurchasable = false;
    expect(issuesFor(catalog)).toContain('catalog/entry/section-not-directly-purchasable');
  });

  it('rejects composition-addition effects referencing unknown profiles (R6)', () => {
    const catalog = structuredClone(classicM01Catalog);
    const group = catalog.optionGroups.find((candidate) => candidate.localId === 'engineer-transport');
    const option = group?.options.find((candidate) => candidate.localId === 'btr80-swap');
    if (option === undefined) throw new Error('fixture option missing');
    option.effects = [
      {
        kind: 'composition-addition',
        root: { nodeId: 'extra', role: 'weapon-team', quantity: 1, children: [
          { nodeId: 'transport', role: 'transport', profileLocalId: 'ghost-profile', quantity: 1 },
        ] },
      },
    ];
    expect(issuesFor(catalog)).toContain('catalog/option/effect-profile-unknown');
  });

  it('rejects composition-addition roots colliding with existing children of the target slot (R6)', () => {
    const catalog = structuredClone(classicM01Catalog);
    // Give the mortar's transport slot an existing child, then add a
    // composition whose root reuses that child's id under the same slot.
    const mortar = catalog.entries.find((candidate) => candidate.localId === 'bmp1-platoon-mortar');
    const transport = mortar?.composition.state === 'known'
      ? mortar.composition.root.children?.find((child) => child.nodeId === 'transport')
      : undefined;
    if (transport === undefined) throw new Error('fixture composition missing');
    transport.children = [
      ...(transport.children ?? []),
      { nodeId: 'crew', role: 'crew', quantity: 1 },
    ];
    const group = catalog.optionGroups.find((candidate) => candidate.localId === 'bmp1-mortar-upgrades');
    const option = group?.options.find((candidate) => candidate.localId === 'mortar-to-mtlb');
    if (option === undefined) throw new Error('fixture option missing');
    option.effects = [
      {
        kind: 'composition-addition',
        root: { nodeId: 'crew', role: 'team', quantity: 1 },
      },
    ];
    expect(issuesFor(catalog)).toContain('catalog/option/addition-node-id-collides');
  });
});
