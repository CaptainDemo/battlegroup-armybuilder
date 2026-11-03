/**
 * Structural and reference integrity issues.
 *
 * These are *document integrity* problems — duplicate ids, orphans, cycles,
 * dangling references, impossible quantities. They are deliberately distinct
 * from game-rule violations (C01–C28): a roster that breaks a points budget
 * or the PT-76 tank exclusion is structurally sound and must still parse and
 * validate here. Conversely, an integrity error means the document cannot be
 * interpreted at all and no evaluation may run on it.
 */
export interface IntegrityIssue {
  /** Stable identifier of the check that produced this issue. */
  readonly checkId: string;
  /** Locator into the document, e.g. "selections[3].parentSelectionId". */
  readonly path: string;
  readonly message: string;
}

export function integrityIssue(checkId: string, path: string, message: string): IntegrityIssue {
  return { checkId, path, message };
}
