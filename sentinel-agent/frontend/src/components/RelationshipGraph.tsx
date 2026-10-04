import React, { useState } from 'react';
import { GraphNode, GraphEdge } from '../lib/api';
import { Network, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface RelationshipGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ nodes, edges }) => {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Compute a circular / radial layout for clean visual aesthetics
  const width = 640;
  const height = 360;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) * 0.75;

  const nodePositions = new Map<string, { x: number; y: number }>();

  nodes.forEach((node, idx) => {
    // Separate alert nodes in center, subjects & sources in middle ring, events in outer ring
    if (node.type === 'alert') {
      const angle = (idx / Math.max(1, nodes.length)) * 2 * Math.PI;
      nodePositions.set(node.id, {
        x: centerX + Math.cos(angle) * (radius * 0.35),
        y: centerY + Math.sin(angle) * (radius * 0.35),
      });
    } else if (node.type === 'subject' || node.type === 'user' || node.type === 'source') {
      const angle = (idx / Math.max(1, nodes.length)) * 2 * Math.PI;
      nodePositions.set(node.id, {
        x: centerX + Math.cos(angle) * (radius * 0.65),
        y: centerY + Math.sin(angle) * (radius * 0.65),
      });
    } else {
      const angle = (idx / Math.max(1, nodes.length)) * 2 * Math.PI;
      nodePositions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
      });
    }
  });

  const getNodeColor = (type: string, severity?: string) => {
    if (type === 'alert') {
      return severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f97316' : '#f59e0b';
    }
    if (type === 'user' || type === 'subject') return '#00d2ff';
    if (type === 'source') return '#a855f7';
    return '#64748b';
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-2xl backdrop-blur-sm flex flex-col">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-200">
            Threat & Entity Relationship Graph
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Alert
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span> Identity
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block"></span> Source IP
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px]">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-500 inline-block"></span> Event
          </span>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="text-center py-16 text-xs text-slate-500">
          No correlated entities to render in relationship graph.
        </div>
      ) : (
        <div className="relative border border-slate-800/80 rounded-lg bg-slate-950 overflow-hidden">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-72 md:h-80 select-none">
            {/* Background grid */}
            <defs>
              <pattern id="graph-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#graph-grid)" />

            {/* Edges */}
            {edges.map((edge, idx) => {
              const srcPos = nodePositions.get(edge.source);
              const tgtPos = nodePositions.get(edge.target);
              if (!srcPos || !tgtPos) return null;

              return (
                <g key={`edge-${idx}`}>
                  <line
                    x1={srcPos.x}
                    y1={srcPos.y}
                    x2={tgtPos.x}
                    y2={tgtPos.y}
                    stroke="#1e293b"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const pos = nodePositions.get(node.id);
              if (!pos) return null;
              const color = getNodeColor(node.type, node.severity);
              const isSelected = selectedNode?.id === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer group"
                >
                  <circle
                    r={node.type === 'alert' ? 12 : 9}
                    fill="#0f172a"
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                    className="transition-all duration-150"
                  />
                  <circle r={node.type === 'alert' ? 5 : 3.5} fill={color} />
                  <text
                    y={node.type === 'alert' ? 22 : 18}
                    textAnchor="middle"
                    fill="#cbd5e1"
                    fontSize="9"
                    fontFamily="monospace"
                    className="pointer-events-none drop-shadow"
                  >
                    {node.label.length > 16 ? node.label.slice(0, 14) + '…' : node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Selected Node Details Tooltip */}
          {selectedNode && (
            <div className="absolute bottom-2 left-2 right-2 p-2.5 bg-slate-900/95 border border-slate-700 rounded-lg text-xs flex items-center justify-between backdrop-blur">
              <div className="flex items-center gap-2">
                <span className="font-mono text-cyan-400 font-semibold">{selectedNode.id}</span>
                <span className="text-slate-400">({selectedNode.type})</span>
                <span className="text-slate-200 font-medium">{selectedNode.label}</span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-200 text-xs px-2 py-0.5 rounded bg-slate-800"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
