import type { Node, Edge } from "@xyflow/react";

export type CanvasNodeType = "file" | "chat" | "terminal" | "sticky";

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

export type CanvasNodeData = FileNodeData | ChatNodeData | TerminalNodeData | StickyNodeData;

export type CanvasNode = Node<CanvasNodeData, CanvasNodeType>;
export type CanvasEdge = Edge;

export type CanvasState = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  viewport: { x: number; y: number; zoom: number };
};
