import React, { useCallback, useRef } from 'react';
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react';
import type { CanvasPanelNodeData } from './canvas.types';

const PANEL_ICONS: Record<string, string> = {
  chat: "💬",
  terminal: ">_",
  editor: "📝",
  "repo-tree": "📂",
  "safe-diff": "🔍",
};

const PANEL_CONTENT_CLASSES: Record<string, string> = {
  chat: "chat-main-column",
  terminal: "terminal-panel-content",
  editor: "code-editor",
  "repo-tree": "repo-tree",
  "safe-diff": "safe-diff-content",
};

export const PanelNode = (props: NodeProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const data = props.data as CanvasPanelNodeData;
  const panelId = data.panelId;
  const minimized = data.minimized;
  const icon = PANEL_ICONS[panelId] ?? "⬜";
  const contentClass = PANEL_CONTENT_CLASSES[panelId] ?? "";

  const handleToggleMinimize = useCallback(() => {
    const event = new CustomEvent("panel:toggle-minimize", {
      detail: { panelId },
      bubbles: true,
    });
    document.dispatchEvent(event);
  }, [panelId]);

  return (
    <div
      className={`spatial-panel ${props.selected ? "spatial-panel--selected" : ""} ${minimized ? "spatial-panel--minimized" : ""}`}
      data-panel-id={panelId}
    >
      <Handle type="target" position={Position.Left} style={{ visibility: "hidden" }} />
      <NodeResizer
        nodeId={props.id}
        isVisible={props.selected}
        minWidth={160}
        minHeight={32}
        handleClassName="spatial-panel-resize-handle"
        lineClassName="spatial-panel-resize-line"
        color="#9479ff"
      />
      <div className="spatial-panel-header">
        <span className="spatial-panel-icon">{icon}</span>
        <span className="spatial-panel-title">{data.title}</span>
        <div className="spatial-panel-header-actions">
          <button
            className="spatial-panel-btn"
            data-panel-action="toggle-minimize"
            onClick={handleToggleMinimize}
            title={minimized ? "Expand" : "Minimize"}
            type="button"
          >
            {minimized ? "□" : "_"}
          </button>
        </div>
      </div>
      {!minimized && (
        <div
          ref={contentRef}
          className={`spatial-panel-body ${contentClass}`}
          data-panel-body={panelId}
        />
      )}
      <Handle type="source" position={Position.Right} style={{ visibility: "hidden" }} />
    </div>
  );
};
