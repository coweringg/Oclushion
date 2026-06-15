type Diagnostic = { from: number; to: number; severity: string; message: string };

const MAX_LINE_LENGTH = 200;

export function lineLinter(view: { state: { doc: { toString: () => string } } }): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const content = view.state.doc.toString();
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const lineStart = content.indexOf(line);
    if (line.length > MAX_LINE_LENGTH) {
      diagnostics.push({
        from: lineStart,
        to: lineStart + line.length,
        severity: "warning",
        message: `Line exceeds ${MAX_LINE_LENGTH} characters`,
      });
    }
  }
  return diagnostics;
}
