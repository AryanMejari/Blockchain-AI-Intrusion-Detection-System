import React, { useState } from 'react';
import { GraphNode, GraphEdge } from '../lib/api';
import { Network, ZoomIn, ZoomOut, RotateCcw, Share2 } from 'lucide-react';

interface RelationshipGraphProps {
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  subject?: string;
}

export const RelationshipGraph: React.FC<RelationshipGraphProps> = ({ graph, subject }) => {
  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Layout coordinates
  const width = 640;
  const height = 360;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) * 0.75;

  const nodePositions = new Map<string, { x: number; y: number }>();

  nodes.forEach((node, idx) => {
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
      return severity === 'critical' ? '#f43f5e' : severity === 'high' ? '#f97316' : '#f59e0b';
    }
    if (type === 'user' || type === 'subject') return '#06b6d4';
    if (type === 'source') return '#c084fc';
    return '#64748b';
  };

  return (
    <div className="neo-card rounded-2xl p-6 shadow-2xl flex flex-col h-full">
      <div className="flex flex-wrap items-center justify-between pb-3 border-b border-white/[0.04] mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-bold tracking-wider uppercase text-slate-200">
            Threat & Entity Correlation Graph
          </h2>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> Alert
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> Identity
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" /> Source IP
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" /> Event
          </span>
        </div>
      </div>

      {nodes.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 neo-well rounded-xl">
          <Share2 className="w-10 h-10 text-slate-600 mb-2" />
          <p className="text-slate-300 text-sm font-semibold">Graph Ready: Awaiting Entities</p>
          <p className="text-slate-500 text-xs mt-1 max-w-sm">
            Relationship nodes link users, IP sources, and Prolog alerts dynamically when correlated events occur.
          </p>
        </div>
      ) : (
        <div className="relative neo-well rounded-xl overflow-hidden flex-1 flex items-center justify-center">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full select-none">
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
                    stroke="rgba(255, 255, 255, 0.08)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
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
                    r={node.type === 'alert' ? 13 : 9}
                    fill="#0f1423"
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                    className="transition-all duration-150"
                  />
                  <circle r={node.type === 'alert' ? 5 : 3.5} fill={color} />
                  <text
                    y={node.type === 'alert' ? 24 : 20}
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
            <div className="absolute bottom-3 left-3 right-3 p-3 neo-card-raised rounded-xl text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-cyan-400 font-bold">{selectedNode.id}</span>
                <span className="text-slate-400 text-[11px]">({selectedNode.type})</span>
                <span className="text-slate-200 font-medium">{selectedNode.label}</span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-200 text-[11px] px-2.5 py-1 rounded-lg neo-btn"
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
