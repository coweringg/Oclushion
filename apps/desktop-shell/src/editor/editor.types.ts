export type Language =
  | "typescript"
  | "javascript"
  | "json"
  | "html"
  | "css"
  | "python"
  | "rust"
  | "markdown"
  | "sql"
  | "xml"
  | "yaml"
  | "toml"
  | "shell"
  | "plaintext";

export type EditorFile = {
  readonly path: string;
  readonly absolutePath: string;
  content: string;
  readonly language: Language;
  readonly size: number;
  modified: boolean;
  readonly createdAt: number;
};

export type EditorState = {
  openFiles: EditorFile[];
  activeFilePath: string | null;
  recentFiles: string[];
  isSaving: boolean;
  lastSaveError: string | null;
};

export type EditorEvent =
  | { type: "file:opened"; path: string }
  | { type: "file:saved"; path: string }
  | { type: "file:closed"; path: string }
  | { type: "file:modified"; path: string; content: string }
  | { type: "file:reverted"; path: string }
  | { type: "tab:switched"; from: string | null; to: string | null }
  | { type: "save:started"; path: string }
  | { type: "save:completed"; path: string }
  | { type: "save:failed"; path: string; error: string };

export type EditorEventListener = (event: EditorEvent) => void;

export type DiffLineType = "added" | "removed" | "unchanged";

export type DiffLine = {
  type: DiffLineType;
  content: string;
  lineNumber: number;
};
