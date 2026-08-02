"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dagre from "@dagrejs/dagre";
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type ReactFlowInstance
} from "@xyflow/react";
import type { ReactNode } from "react";

import type { GraphResponse, ObjectRow } from "../lib/lws-api/types";

type RelationshipFlowProps = {
  graph: GraphResponse | null;
  focusId?: string;
  className?: string;
  showMiniMap?: boolean;
  onSelect?: (id: string) => void;
};

type FlowNodeData = Record<string, unknown> & {
  label: ReactNode;
  object?: ObjectRow;
  placeholder?: GraphResponse["placeholders"][number];
  focused: boolean;
};

type FlowNode = Node<FlowNodeData>;

const NODE_WIDTH = 240;
const NODE_HEIGHT = 82;

export function RelationshipFlow({ graph, focusId, className = "", showMiniMap = false, onSelect }: RelationshipFlowProps) {
  const layouted = useMemo(() => buildFlowElements(graph), [graph]);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges);
  const [activeId, setActiveId] = useState<string | undefined>(focusId);
  const [instance, setInstance] = useState<ReactFlowInstance<FlowNode, Edge> | null>(null);

  useEffect(() => {
    setNodes(markActiveNodes(layouted.nodes, focusId));
    setEdges(markActiveEdges(layouted.edges, focusId));
    setActiveId(focusId);
  }, [focusId, layouted.edges, layouted.nodes, setEdges, setNodes]);

  useEffect(() => {
    setNodes((current) => markActiveNodes(current, activeId));
    setEdges((current) => markActiveEdges(current, activeId));
  }, [activeId, setEdges, setNodes]);

  const fitView = useCallback(() => {
    void instance?.fitView({ padding: 0.18, duration: 240 });
  }, [instance]);

  const resetLayout = useCallback(() => {
    setNodes(markActiveNodes(layouted.nodes, activeId));
    setEdges(markActiveEdges(layouted.edges, activeId));
    window.requestAnimationFrame(fitView);
  }, [activeId, fitView, layouted.edges, layouted.nodes, setEdges, setNodes]);

  if (!graph || layouted.nodes.length === 0) {
    return (
      <div className="empty-relations">
        <h3>No visible graph data</h3>
        <p className="muted">No visible relationships were returned for this graph query.</p>
      </div>
    );
  }

  return (
    <div className={`relationship-flow ${className}`.trim()}>
      <div className="relationship-flow-toolbar">
        <button type="button" onClick={resetLayout}>Auto layout</button>
        <button type="button" onClick={fitView}>Fit</button>
        <span>Drag canvas or nodes. Scroll zooms. Double click opens an object.</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.35}
        maxZoom={1.6}
        nodesDraggable
        nodesConnectable={false}
        edgesFocusable
        elementsSelectable
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        selectionOnDrag={false}
        proOptions={{ hideAttribution: true }}
        onInit={setInstance}
        onNodeClick={(_, node) => setActiveId(node.id)}
        onNodeDoubleClick={(_, node) => {
          if (!node.data.placeholder && node.id !== focusId) {
            onSelect?.(node.id);
          }
        }}
        onNodeDragStart={(_, node) => setActiveId(node.id)}
        onEdgeClick={(_, edge) => setActiveId(edge.id)}
        onEdgeDoubleClick={(_, edge) => {
          if (edge.id !== focusId) {
            onSelect?.(edge.id);
          }
        }}
      >
        <Background color="#2b3440" gap={24} />
        <Controls showInteractive={false} />
        {showMiniMap ? <MiniMap pannable zoomable nodeStrokeWidth={3} /> : null}
      </ReactFlow>
    </div>
  );
}

function buildFlowElements(graph: GraphResponse | null): { nodes: FlowNode[]; edges: Edge[] } {
  if (!graph) {
    return { nodes: [], edges: [] };
  }

  const objectById = new Map(graph.nodes.map((object) => [object.id, object]));
  const placeholders = graph.placeholders ?? [];
  const endpointIds = new Set<string>();
  for (const edge of graph.edges) {
    endpointIds.add(edge.source_id);
    endpointIds.add(edge.target_id);
  }

  const rows = graph.nodes.filter((object) => object.object_kind === "node" && (endpointIds.has(object.id) || graph.edges.length === 0));
  const nodeRows = rows.length ? rows : graph.nodes.filter((object) => object.object_kind === "node");
  const placeholderRows = placeholders.filter((placeholder) => endpointIds.has(placeholder.id));
  const graphlib = new dagre.graphlib.Graph({ multigraph: true });
  graphlib.setGraph({ rankdir: "LR", align: "UL", ranksep: 120, nodesep: 58, marginx: 24, marginy: 24 });
  graphlib.setDefaultEdgeLabel(() => ({}));

  for (const object of nodeRows) {
    graphlib.setNode(object.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const placeholder of placeholderRows) {
    graphlib.setNode(placeholder.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  const flowEdges = graph.edges
    .filter((edge) => graphlib.hasNode(edge.source_id) && graphlib.hasNode(edge.target_id))
    .map((edge) => {
      const edgeObject = objectById.get(edge.edge_id);
      graphlib.setEdge(edge.source_id, edge.target_id, {}, edge.edge_id);
      return {
        id: edge.edge_id,
        source: edge.source_id,
        target: edge.target_id,
        label: edge.relation_type,
        markerEnd: { type: MarkerType.ArrowClosed },
        type: "smoothstep",
        className: "relationship-edge",
        data: { title: edgeObject?.title ?? edge.edge_id }
      } satisfies Edge;
    });

  dagre.layout(graphlib);

  const flowNodes = nodeRows.map((object) => {
    const position = graphlib.node(object.id) ?? { x: 0, y: 0 };
    return {
      id: object.id,
      type: "default",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2
      },
      data: {
        label: (
          <div className="relationship-node-label">
            <strong>{object.title}</strong>
            <span>{object.id}</span>
          </div>
        ),
        object,
        focused: false
      },
      className: "relationship-node"
    } satisfies Node<FlowNodeData>;
  });

  const placeholderNodes = placeholderRows.map((placeholder) => {
    const position = graphlib.node(placeholder.id) ?? { x: 0, y: 0 };
    return {
      id: placeholder.id,
      type: "default",
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      position: {
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2
      },
      data: {
        label: (
          <div className="relationship-node-label">
            <strong>Unreadable endpoint</strong>
            <span>{placeholder.id}</span>
          </div>
        ),
        placeholder,
        focused: false
      },
      className: "relationship-node placeholder"
    } satisfies Node<FlowNodeData>;
  });

  return { nodes: [...flowNodes, ...placeholderNodes], edges: flowEdges };
}

function markActiveNodes(nodes: FlowNode[], activeId?: string): FlowNode[] {
  return nodes.map((node) => ({
    ...node,
    selected: node.id === activeId,
    className: [
      "relationship-node",
      node.data.placeholder ? "placeholder" : "",
      node.id === activeId ? "selected" : ""
    ].filter(Boolean).join(" "),
    data: {
      ...node.data,
      focused: node.id === activeId
    }
  }));
}

function markActiveEdges(edges: Edge[], activeId?: string): Edge[] {
  return edges.map((edge) => ({
    ...edge,
    selected: edge.id === activeId,
    animated: edge.id === activeId,
    className: edge.id === activeId ? "relationship-edge selected" : "relationship-edge"
  }));
}
