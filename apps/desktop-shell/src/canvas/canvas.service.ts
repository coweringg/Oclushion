import { applyNodeChanges, applyEdgeChanges, type NodeChange, type EdgeChange } from "@xyflow/react";
import { logger } from "../utils/logger";
import { z } from "zod";
import type { CanvasNode, CanvasEdge, CanvasState, CanvasNodeType } from "./canvas.types";
import type { KeyValueStore } from "../persistent-store";

const CANVAS_STORAGE_KEY = "ocl_canvas_state";

export class CanvasService {
  private nodes: CanvasNode[] = [];
  private edges: CanvasEdge[] = [];
  private viewport = { x: 0, y: 0, zoom: 1 };
  
  private listeners = new Set<() => void>();
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly kvStore: KeyValueStore) {
    this.loadState();
  }

  public getNodes(): CanvasNode[] {
    return this.nodes;
  }

  public getEdges(): CanvasEdge[] {
    return this.edges;
  }

  public getViewport() {
    return this.viewport;
  }

  public onNodesChange(changes: NodeChange[]) {
    this.nodes = applyNodeChanges(changes, this.nodes) as CanvasNode[];
    this.emitAndSave();
  }

  public onEdgesChange(changes: EdgeChange[]) {
    this.edges = applyEdgeChanges(changes, this.edges) as CanvasEdge[];
    this.emitAndSave();
  }

  public addNode(type: CanvasNodeType, data: any, position = { x: 0, y: 0 }): CanvasNode {
    const newNode: CanvasNode = {
      id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      position,
      data,
    };
    this.nodes = [...this.nodes, newNode];
    
    if (this.nodes.length > 1) {
      const last = this.nodes[this.nodes.length - 2];
      newNode.position = { x: last.position.x + 50, y: last.position.y + 50 };
    }

    this.emitAndSave();
    return newNode;
  }

  public addEdge(sourceId: string, targetId: string, label?: string) {
    const newEdge: CanvasEdge = {
      id: `e-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      label,
      animated: true,
      style: { stroke: "#6366f1", strokeWidth: 2 },
    };
    this.edges = [...this.edges, newEdge];
    this.emitAndSave();
  }

  public setViewport(viewport: { x: number; y: number; zoom: number }) {
    this.viewport = viewport;
    this.debouncedSave();
  }

  public autoLinkImports(dependencyMap: Record<string, string[]>) {
    let changed = false;
    for (const node of this.nodes) {
      if (node.type !== "file") continue;
      const filePath = (node.data as any).filePath;
      if (!filePath) continue;

      const deps = dependencyMap[filePath] || [];
      for (const dep of deps) {
        const targetNode = this.nodes.find(n => n.type === "file" && (n.data as any).filePath === dep);
        if (targetNode) {
          const edgeId = `e-${node.id}-${targetNode.id}`;
          if (!this.edges.some(e => e.id === edgeId)) {
            this.edges.push({
              id: edgeId,
              source: node.id,
              target: targetNode.id,
              animated: true,
              style: { stroke: "#a8a29e", strokeDasharray: "4" },
            });
            changed = true;
          }
        }
      }
    }
    if (changed) {
      this.edges = [...this.edges];
      this.emitAndSave();
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitAndSave() {
    for (const listener of this.listeners) listener();
    this.debouncedSave();
  }

  private debouncedSave() {
    if (this.saveDebounceTimer) clearTimeout(this.saveDebounceTimer);
    this.saveDebounceTimer = setTimeout(() => {
      this.saveState();
      this.saveDebounceTimer = null;
    }, 500);
  }

  private async saveState() {
    try {
      const state: CanvasState = {
        nodes: this.nodes,
        edges: this.edges,
        viewport: this.viewport,
      };
      await this.kvStore.setItem(CANVAS_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      logger.warn("CanvasService", "Failed to save state", err);
    }
  }

  private async loadState() {
    try {
      const raw = await this.kvStore.getItem(CANVAS_STORAGE_KEY);
      if (raw) {
        const state = JSON.parse(raw) as CanvasState;
        this.nodes = state.nodes || [];
        this.edges = state.edges || [];
        this.viewport = state.viewport || { x: 0, y: 0, zoom: 1 };
        for (const listener of this.listeners) listener();
      }
    } catch (err) {
      logger.warn("CanvasService", "Failed to load state", err);
    }
  }
}
