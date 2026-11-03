import { expect, it } from 'vitest';
import { b01Roster } from '@battlegroup/core/samples';
import { makeSession, moveHistory, recordEdit } from './session';
it('undoes and redoes choices with fresh revisions rather than reviving stale snapshots', () => {
  const initial = makeSession(b01Roster());
  const changed = {
    ...structuredClone(initial.document),
    name: 'Edited',
    revision: 'edit-2',
  };
  const edited = recordEdit(initial, changed);
  const undone = moveHistory(edited, 'undo', 'edit-3');
  expect(undone.document.name).toBe(initial.document.name);
  expect(undone.document.revision).toBe('edit-3');
  const redone = moveHistory(undone, 'redo', 'edit-4');
  expect(redone.document.name).toBe('Edited');
  expect(redone.document.revision).toBe('edit-4');
  expect(initial.document.name).not.toBe('Edited');
  expect(() => moveHistory(redone, 'undo', 'edit-4')).toThrow('revision');
});
it('bounds history, clears redo after branching and keeps different rosters independent', () => {
  let session = makeSession(b01Roster());
  for (let i = 0; i < 60; i++)
    session = recordEdit(session, {
      ...structuredClone(session.document),
      revision: `edit-${i}`,
    });
  expect(session.past).toHaveLength(50);
  const undone = moveHistory(session, 'undo', 'new-revision');
  expect(undone.future).toHaveLength(1);
  expect(
    recordEdit(undone, {
      ...structuredClone(undone.document),
      revision: 'branch',
    }).future,
  ).toEqual([]);
  expect(() =>
    recordEdit(session, {
      ...structuredClone(session.document),
      rosterId: 'other',
    }),
  ).toThrow('another roster');
});
