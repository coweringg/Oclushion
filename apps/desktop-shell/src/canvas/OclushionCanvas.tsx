import React, { useCallback, useEffect } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  type Connection,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import type { CanvasService } from './canvas.service';
import type { CanvasNode, CanvasEdge } from './canvas.types';

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
};

export const OclushionCanvas = ({ canvasService }: { canvasService: CanvasService }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>([]);

  useEffect(() => {
    const sync = () => {
      setNodes(canvasService.getNodes());
      setEdges(canvasService.getEdges());
    };
    sync();
    return canvasService.subscribe(sync);
  }, [canvasService, setNodes, setEdges]);

  const onNodesChangeAdapter = useCallback(
    (changes: any) => canvasService.onNodesChange(changes),
    [canvasService]
  );
  
  const onEdgesChangeAdapter = useCallback(
    (changes: any) => canvasService.onEdgesChange(changes),
    [canvasService]
  );

  const onConnect = useCallback(
    (params: Connection | Edge) => canvasService.addEdge(params.source, params.target),
    [canvasService]
  );

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: '#18181b' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeAdapter}
        onEdgesChange={onEdgesChangeAdapter}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls style={{ backgroundColor: '#27272a', border: '1px solid #3f3f46' }} />
        <MiniMap 
          nodeStrokeColor={(n) => {
            if (n.type === 'file') return '#3b82f6';
            if (n.type === 'chat') return '#8b5cf6';
            if (n.type === 'sticky') return '#eab308';
            return '#52525b';
          }} 
          nodeColor="#27272a" 
          maskColor="rgba(0, 0, 0, 0.4)"
          style={{ backgroundColor: '#18181b', border: '1px solid #3f3f46' }}
        />
        <Background gap={16} size={1} color="#3f3f46" />
      </ReactFlow>
    </div>
  );
};
