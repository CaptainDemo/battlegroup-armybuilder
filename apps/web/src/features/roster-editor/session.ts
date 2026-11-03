import type { RosterDocument } from '@battlegroup/core';
export interface EditorSession {
  document: RosterDocument;
  past: RosterDocument[];
  future: RosterDocument[];
}
export const makeSession = (document: RosterDocument): EditorSession => ({
  document: structuredClone(document),
  past: [],
  future: [],
});
export function recordEdit(
  session: EditorSession,
  document: RosterDocument,
): EditorSession {
  if (document.rosterId !== session.document.rosterId)
    throw new Error('Cannot edit another roster through this session');
  return {
    document: structuredClone(document),
    past: [...session.past, structuredClone(session.document)].slice(-50),
    future: [],
  };
}
export function moveHistory(
  session: EditorSession,
  direction: 'undo' | 'redo',
  revision: string,
): EditorSession {
  if (!revision || revision === session.document.revision)
    throw new Error('History changes require a new edit revision');
  if (direction === 'undo') {
    const previous = session.past.at(-1);
    if (!previous) return session;
    return {
      document: { ...structuredClone(previous), revision },
      past: session.past.slice(0, -1),
      future: [structuredClone(session.document), ...session.future].slice(
        0,
        50,
      ),
    };
  }
  const next = session.future[0];
  if (!next) return session;
  return {
    document: { ...structuredClone(next), revision },
    past: [...session.past, structuredClone(session.document)].slice(-50),
    future: session.future.slice(1),
  };
}
