/** Converts the small set of markdown this page supports into HTML. */
export function formatNote(note: string): string {
  return note.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
}
