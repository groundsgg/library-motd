import type { ServerListDocument } from "../../core/model.js";
export interface HistoryEntry {
  document: ServerListDocument;
  selection?: { field: string; from: number; to: number };
}
export class EditorHistory {
  private undoEntries: HistoryEntry[] = [];
  private redoEntries: HistoryEntry[] = [];
  private lastTyping = 0;
  private lastTypingField: string | undefined;
  record(entry: HistoryEntry, typing = false): void {
    const now = Date.now();
    if (
      !typing ||
      !this.lastTyping ||
      now - this.lastTyping > 800 ||
      entry.selection?.field !== this.lastTypingField
    ) {
      this.undoEntries.push(entry);
      if (this.undoEntries.length > 100) this.undoEntries.shift();
    }
    this.redoEntries = [];
    this.lastTyping = typing ? now : 0;
    this.lastTypingField = typing ? entry.selection?.field : undefined;
  }
  undo(current: HistoryEntry): HistoryEntry | undefined {
    this.lastTyping = 0;
    this.lastTypingField = undefined;
    const previous = this.undoEntries.pop();
    if (previous) this.redoEntries.push(current);
    return previous;
  }
  redo(current: HistoryEntry): HistoryEntry | undefined {
    this.lastTyping = 0;
    this.lastTypingField = undefined;
    const next = this.redoEntries.pop();
    if (next) this.undoEntries.push(current);
    return next;
  }
  clear(): void {
    this.undoEntries = [];
    this.redoEntries = [];
    this.lastTyping = 0;
    this.lastTypingField = undefined;
  }
}
