import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { CanvasService } from './canvas.service';
import type { CanvasNode, CanvasEdge, CanvasPanelNodeData } from './canvas.types';
import type { SpatialLayoutService } from './spatial-layout.service';
import { PanelNode } from './PanelNode';

const SNAP_GRID: [number, number] = [20, 20];

const nodeTypes = {
  file: ({ data }: any) => (
    <div className="bg-zinc-800 border border-zinc-700 p-2 rounded text-xs text-white shadow-xl min-w-[150px]">
      <div className="font-bold border-b border-zinc-700 pb-1 mb-1 opacity-70">File</div>
      <div className="truncate">{data.filePath}</div>
    </div>
  ),
  chat: ({ data }: any) => (
    <div className="bg-indigo-900 border border-indigo-700 p-2 rounded text-xs text-white shadow-xl min-w-[200px]">
      <div className="font-bold border-b border-indigo-700 pb-1 mb-1 opacity-70">AI Chat</div>
      <div className="truncate">{data.title}</div>
    </div>
  ),
  terminal: ({ data }: any) => (
    <div className="bg-black border border-zinc-700 p-2 rounded text-xs text-green-400 shadow-xl min-w-[200px]">
      <div className="font-bold border-b border-zinc-800 pb-1 mb-1 opacity-70">Terminal</div>
      <div className="truncate">Cwd: {data.cwd || './'}</div>
    </div>
  ),
  sticky: ({ data }: any) => (
    <div className="bg-yellow-600 border border-yellow-500 p-2 rounded text-xs text-black shadow-xl min-w-[150px] font-medium">
      {data.content}
    </div>
  ),
  panel: PanelNode as any,
};

export const OclushionCanvas = (props: {
  canvasService: CanvasService;
  spatialLayoutService?: SpatialLayoutService;
  mode?: "graph" | "spatial";
}) => {
  return (
    <ReactFlowProvider>
      <CanvasFlow {...props} />
    </ReactFlowProvider>
  );
};

const CanvasFlow = ({
  canvasService,
  spatialLayoutService,
  mode,
}: {
  canvasService: CanvasService;
  spatialLayoutService?: SpatialLayoutService;
  mode?: "graph" | "spatial";
}) => {
  const isSpatial = !!(mode === "spatial" && spatialLayoutService);
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>([]);
  const reactFlowInstance = useReactFlow();

  useEffect(() => {
    if (!isSpatial || !spatialLayoutService) {
      return;
    }

    const sync = () => {
      const panelNodes: CanvasNode[] = spatialLayoutService.getPanels()
        .filter((p) => p.panelId !== "safe-diff" || !p.minimized)
        .map((layout) => ({
          id: `panel-${layout.panelId}`,
          type: "panel",
          position: { x: layout.x, y: layout.y },
          data: {
            panelId: layout.panelId,
            minimized: layout.minimized,
            title: getPanelTitle(layout.panelId),
          } as CanvasPanelNodeData,
          width: layout.width,
          height: layout.height,
          draggable: true,
          selected: false,
        }));
      setNodes(panelNodes);
      setEdges([]);
    };

    sync();
    const unsub = spatialLayoutService.subscribe(sync);
    return () => { unsub(); };
  }, [spatialLayoutService, setNodes, setEdges, isSpatial]);

  useEffect(() => {
    if (isSpatial) {
      return;
    }

    const sync = () => {
      setNodes(canvasService.getNodes());
      setEdges(canvasService.getEdges());
    };
    sync();
    const unsub = canvasService.subscribe(sync);
    return () => { unsub(); };
  }, [canvasService, setNodes, setEdges, isSpatial]);

  const onNodesChangeAdapter = useCallback(
    (changes: any) => {
      if (isSpatial && spatialLayoutService) {
        for (const change of changes) {
          const panelId = change.id?.replace("panel-", "") as CanvasPanelNodeData["panelId"];
          if (!panelId) continue;

          if (change.type === "position" && change.position && !change.dragging) {
            const snappedX = Math.round(change.position.x / SNAP_GRID[0]) * SNAP_GRID[0];
            const snappedY = Math.round(change.position.y / SNAP_GRID[1]) * SNAP_GRID[1];
            spatialLayoutService.updatePanel(panelId, { x: snappedX, y: snappedY });
          }
          if (change.type === "dimensions" && change.dimensions) {
            spatialLayoutService.updatePanel(panelId, {
              width: Math.round(change.dimensions.width ?? 300),
              height: Math.round(change.dimensions.height ?? 200),
            });
          }
        }
      }
      if (!isSpatial) {
        canvasService.onNodesChange(changes);
      }
    },
    [canvasService, spatialLayoutService, isSpatial]
  );

  const onEdgesChangeAdapter = useCallback(
    (changes: any) => {
      if (!isSpatial) {
        canvasService.onEdgesChange(changes);
      }
    },
    [canvasService, isSpatial]
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => {
      if (!isSpatial) {
        canvasService.addEdge(params.source, params.target);
      }
    },
    [canvasService, isSpatial]
  );

  const onNodeDragStop = useCallback(
    (_event: any, node: Node) => {
      if (isSpatial && spatialLayoutService && node.type === "panel") {
        const panelId = (node.data as CanvasPanelNodeData).panelId;
        const snappedX = Math.round(node.position.x / SNAP_GRID[0]) * SNAP_GRID[0];
        const snappedY = Math.round(node.position.y / SNAP_GRID[1]) * SNAP_GRID[1];
        spatialLayoutService.updatePanel(panelId, { x: snappedX, y: snappedY });
      }
    },
    [spatialLayoutService, isSpatial]
  );

  useEffect(() => {
    if (!isSpatial || !spatialLayoutService) return;

    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail?.panelId) {
        spatialLayoutService.toggleMinimize(detail.panelId);
      }
    };

    document.addEventListener("panel:toggle-minimize", handler);
    return () => document.removeEventListener("panel:toggle-minimize", handler);
  }, [spatialLayoutService, isSpatial]);

  const handleZoomIn = useCallback(() => {
    reactFlowInstance.zoomIn();
  }, [reactFlowInstance]);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.zoomOut();
  }, [reactFlowInstance]);

  const handleZoomReset = useCallback(() => {
    reactFlowInstance.zoomTo(1);
  }, [reactFlowInstance]);

  const handleAutoLayout = useCallback(() => {
    spatialLayoutService?.autoLayout();
  }, [spatialLayoutService]);

  const handleResetLayout = useCallback(() => {
    spatialLayoutService?.resetLayout();
  }, [spatialLayoutService]);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#18181b' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeAdapter}
        onEdgesChange={onEdgesChangeAdapter}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        fitView={!isSpatial}
        minZoom={0.1}
        maxZoom={4}
        snapToGrid={isSpatial}
        snapGrid={isSpatial ? SNAP_GRID : undefined}
        nodesDraggable={true}
        panOnDrag={true}
        deleteKeyCode={isSpatial ? null : "Delete"}
      >
        <Controls style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }} />
        <MiniMap
          nodeStrokeColor={(n) => {
            if (n.type === 'file') return '#3b82f6';
            if (n.type === 'chat') return '#8b5cf6';
            if (n.type === 'sticky') return '#eab308';
            if (n.type === 'panel') return '#45e5a2';
            return '#52525b';
          }}
          nodeColor="#27272a"
          maskColor="rgba(0, 0, 0, 0.4)"
          style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
        />
        <Background gap={16} size={1} color="#3f3f46" />
        {isSpatial && (
          <Panel position="top-left" className="canvas-toolbar">
            <button className="canvas-toolbar-btn" onClick={handleAutoLayout} title="Auto-layout panels" type="button">
              ⊞ Auto
            </button>
            <button className="canvas-toolbar-btn" onClick={handleResetLayout} title="Reset layout" type="button">
              ⟲ Reset
            </button>
            <span className="canvas-toolbar-sep" />
            <button className="canvas-toolbar-btn" onClick={handleZoomIn} title="Zoom in" type="button">
              ＋
            </button>
            <button className="canvas-toolbar-btn" onClick={handleZoomOut} title="Zoom out" type="button">
              −
            </button>
            <button className="canvas-toolbar-btn" onClick={handleZoomReset} title="Reset zoom" type="button">
              ⊡ 1:1
            </button>
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
};

function getPanelTitle(panelId: CanvasPanelNodeData["panelId"]): string {
  const titles: Record<CanvasPanelNodeData["panelId"], string> = {
    "chat": "AI Chat",
    "terminal": "Terminal",
    "editor": "Editor",
    "repo-tree": "Repository",
    "safe-diff": "Safe Diff",
  };
  return titles[panelId] ?? panelId;
}
