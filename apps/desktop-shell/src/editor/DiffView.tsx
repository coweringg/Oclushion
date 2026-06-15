import { useState } from "react";
import type { DiffHunk } from "./diff-inline.service";

type DiffFile = {
  path: string;
  oldContent: string;
  newContent: string;
  hunks: DiffHunk[];
};

type DiffViewProps = {
  files: DiffFile[];
  onAcceptHunk: (filePath: string, hunkId: string) => void;
  onRejectHunk: (filePath: string, hunkId: string) => void;
  onAcceptAll: (filePath: string) => void;
  onRejectAll: (filePath: string) => void;
  onRevert: (filePath: string) => void;
};

export function DiffView({
  files,
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
  onRevert,
}: DiffViewProps) {
  const [activeFile, setActiveFile] = useState<string | null>(files[0]?.path ?? null);

  const currentFile = files.find((f) => f.path === activeFile);

  return (
    <div className="diff-view">
      <div className="diff-sidebar">
        <h3>Changed Files</h3>
        <ul>
          {files.map((file) => (
            <li
              key={file.path}
              className={file.path === activeFile ? "active" : ""}
              onClick={() => setActiveFile(file.path)}
            >
              {file.path}
            </li>
          ))}
        </ul>
      </div>

      <div className="diff-content">
        {currentFile ? (
          <>
            <div className="diff-actions">
              <button onClick={() => onAcceptAll(currentFile.path)}>Accept All</button>
              <button onClick={() => onRejectAll(currentFile.path)}>Reject All</button>
              <button onClick={() => onRevert(currentFile.path)}>Revert</button>
            </div>
            <div className="diff-hunks">
              {currentFile.hunks.map((hunk) => (
                <div key={hunk.id} className={`diff-hunk ${hunk.accepted ?? "pending"}`}>
                  <div className="diff-hunk-header">
                    <span>Hunk {hunk.id}</span>
                    {hunk.accepted === null && (
                      <div className="hunk-actions">
                        <button onClick={() => onAcceptHunk(currentFile.path, hunk.id)}>
                          Accept
                        </button>
                        <button onClick={() => onRejectHunk(currentFile.path, hunk.id)}>
                          Reject
                        </button>
                      </div>
                    )}
                    {hunk.accepted === true && <span className="badge accepted">Accepted</span>}
                    {hunk.accepted === false && <span className="badge rejected">Rejected</span>}
                  </div>
                  <pre className="diff-hunk-lines">
                    {hunk.lines.map((line, i) => (
                      <div key={i} className={`diff-line ${line.type}`}>
                        <span className="diff-line-number">{line.lineNumber}</span>
                        <span className="diff-line-content">{line.content}</span>
                      </div>
                    ))}
                  </pre>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="diff-empty">Select a file to view changes</div>
        )}
      </div>
    </div>
  );
}
