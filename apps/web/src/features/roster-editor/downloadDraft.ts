export function downloadDraft(document: unknown, name: string): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }),
  );
  const link = window.document.createElement('a');
  link.href = url;
  link.download = name.replace(/[^a-zA-Z0-9_-]/g, '_') + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
