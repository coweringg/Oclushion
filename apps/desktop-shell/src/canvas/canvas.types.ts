import type { Node, Edge } from "@xyflow/react";

export type CanvasNodeType = "file" | "chat" | "terminal" | "sticky" | "panel";

export type FileNodeData = {
  filePath: string;
  isModified: boolean;
  language: string;
};

export type ChatNodeData = {
  sessionId: string;
  title: string;
};

export type TerminalNodeData = {
  command?: string;
  cwd?: string;
};

export type StickyNodeData = {
  content: string;
  color?: "yellow" | "blue" | "pink" | "green";
};

export type CanvasPanelNodeData = {
  panelId: "chat" | "terminal" | "editor" | "repo-tree" | "safe-diff";
  minimized: boolean;
  title: string;
};

export type CanvasNodeData = FileNodeData | ChatNodeData | TerminalNodeData | StickyNodeData | CanvasPanelNodeData;

export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>;
export type CanvasEdge = Edge;

export type CanvasState = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: { x: number; y: number; zoom: number };
};

export type LayoutMode = "fixed" | "canvas";

export type PanelLayout = {
  panelId: CanvasPanelNodeData["panelId"];
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
};

export type SpatialLayoutState = {
  panels: PanelLayout[];
  viewport: { x: number; y: number; zoom: number };
};
