"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useReactFlow,
  useNodesState,
  type EdgeProps,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance
} from "@xyflow/react";

import type { NodeTimelineItem, TimelineItem, TimelineResponse } from "../lib/lws-api/types";
import {
  buildTimelineScene,
  type TimelineSceneEdgeData,
  type TimelineSceneNodeData
} from "../lib/timeline/scene";
import { bucketQueryRange, type TimelineGranularity } from "../lib/timeline/granularity";

type TimelineFlowProps = {
  response: TimelineResponse;
  selectionScopeKey: string;
  selectedId: string | null;
  selectedEdgeId: string | null;
  onSelect: (item: NodeTimelineItem | null) => void;
  onSelectEdge: (edgeId: string | null) => void;
  onOpenObject: (objectId: string) => void;
  granularity: TimelineGranularity;
  onDrill: (range: { from: string; to: string; granularity: Exclude<TimelineGranularity, "auto"> }) => void;
  onZoomOut: () => void;
  canZoomOut: boolean;
};

const TIMELINE_NODE_TYPES = Object.freeze({
  timelinePoint: TimelinePointNode,
  timelineInterval: TimelineIntervalNode,
  timelineUndated: TimelineUndatedNode,
  timelineTick: TimelineTickNode,
  timelineLane: TimelineLaneNode
});

const TIMELINE_EDGE_TYPES = Object.freeze({ timelineLineage: TimelineLineageEdge });

export function TimelineFlow({ response, selectionScopeKey, selectedId, selectedEdgeId, onSelect, onSelectEdge, onOpenObject, granularity, onDrill, onZoomOut, canZoomOut }: TimelineFlowProps) {
  const scene = useMemo(() => buildTimelineScene(response, { granularity }), [response, granularity]);
  const nodeTypesRef = useRef(TIMELINE_NODE_TYPES);
  const edgeTypesRef = useRef(TIMELINE_EDGE_TYPES);
  const draggedEdgeIdRef = useRef<string | null>(null);
  const [instance, setInstance] = useState<ReactFlowInstance<Node<TimelineSceneNodeData>, Edge<TimelineSceneEdgeData>> | null>(null);
  const [selectedSceneNodeId, setSelectedSceneNodeId] = useState<string | null>(null);
  const layoutNodes = useMemo<Array<Node<TimelineSceneNodeData>>>(() => scene.nodes.map((node) => ({
    ...node,
    draggable: node.data.item !== undefined
  })), [scene.nodes]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<TimelineSceneNodeData>>(layoutNodes);
  const nodeCopies = useMemo(() => {
    const copies = new Map<string, Array<{ id: string; lane?: string }>>();
    for (const node of scene.nodes) {
      const item = (node.data as TimelineSceneNodeData).item;
      if (item?.object_kind !== "node") continue;
      const entries = copies.get(item.object_id) ?? [];
      entries.push({ id: node.id, lane: (node.data as TimelineSceneNodeData).lane });
      copies.set(item.object_id, entries);
    }
    return copies;
  }, [scene.nodes]);
  const selectedLane = useMemo(() => {
    if (!selectedSceneNodeId) return undefined;
    return (scene.nodes.find((node) => node.id === selectedSceneNodeId)?.data as TimelineSceneNodeData | undefined)?.lane;
  }, [scene.nodes, selectedSceneNodeId]);
  const sceneNodeIdFor = useCallback((objectId: string, preferredLane?: string) => {
    const copies = nodeCopies.get(objectId) ?? [];
    return copies.find((copy) => copy.lane === preferredLane)?.id ?? copies[0]?.id;
  }, [nodeCopies]);
  const facetGrouping = response.query.group_by === "tag" || response.query.group_by === "scope" || response.query.group_by === "collection";
  const focusEdge = useCallback((edgeId: string) => {
    if (!facetGrouping) {
      setNodes((current) => current.map((node) => ({ ...node, selected: false })));
      setSelectedSceneNodeId(null);
      onSelect(null);
    }
    onSelectEdge(edgeId);
  }, [facetGrouping, onSelect, onSelectEdge, setNodes]);
  const focusDraggedEdge = useCallback((edgeId: string) => {
    draggedEdgeIdRef.current = edgeId;
    focusEdge(edgeId);
  }, [focusEdge]);
  const edges = useMemo(() => scene.edges.map((edge) => {
    const data = edge.data as TimelineSceneEdgeData;
    const selected = edge.id === selectedEdgeId;
    const connectedToSelectedNode = selectedId !== null && (data.sourceObjectId === selectedId || data.targetObjectId === selectedId);
    const emphasized = selected || connectedToSelectedNode;
    const source = data.sourceObjectId === selectedId && selectedSceneNodeId ? selectedSceneNodeId : sceneNodeIdFor(data.sourceObjectId, selectedLane);
    const target = data.targetObjectId === selectedId && selectedSceneNodeId ? selectedSceneNodeId : sceneNodeIdFor(data.targetObjectId, selectedLane);
    return {
      ...edge,
      source: source ?? edge.source,
      target: target ?? edge.target,
      hidden: facetGrouping && !connectedToSelectedNode,
      selected,
      selectable: !facetGrouping || connectedToSelectedNode,
      data: { ...data, emphasized, selected, onFocus: focusDraggedEdge },
      zIndex: emphasized ? 4 : 1
    };
  }), [facetGrouping, focusDraggedEdge, scene.edges, sceneNodeIdFor, selectedEdgeId, selectedId, selectedLane, selectedSceneNodeId]);

  const fitScene = useCallback(() => {
    void instance?.fitView({ padding: 0.1, duration: 260, maxZoom: 1.15 });
  }, [instance]);
  const clearSelection = useCallback(() => {
    setNodes((current) => current.map((node) => ({ ...node, selected: false })));
    onSelectEdge(null);
    setSelectedSceneNodeId(null);
    onSelect(null);
  }, [onSelect, onSelectEdge, setNodes]);
  const clearSelectionRef = useRef(clearSelection);
  clearSelectionRef.current = clearSelection;

  useEffect(() => {
    const frame = window.requestAnimationFrame(fitScene);
    return () => window.cancelAnimationFrame(frame);
  }, [fitScene, scene.signature]);

  useEffect(() => { setNodes(layoutNodes); }, [layoutNodes, scene.signature, setNodes]);

  // Parent callbacks are recreated when the selected object changes.  Reset only
  // when the query scope changes, otherwise a click is immediately undone.
  useEffect(() => { clearSelectionRef.current(); }, [selectionScopeKey]);

  return (
    <section className="timeline-flow" aria-label="Interactive knowledge timeline">
      <div className="timeline-flow-toolbar">
        <button type="button" onClick={fitScene}>Fit scene</button>
        <button type="button" onClick={onZoomOut} disabled={!canZoomOut}>Zoom out</button>
        <span>Display: {scene.granularity} · Wheel: zoom · Drag canvas: pan · Drag Node: temporary relation preview · Drag Edge: adjust relation path{facetGrouping ? " · Facet lane: select a Node to show its direct relations" : ""}</span>
      </div>
      <ReactFlow<Node<TimelineSceneNodeData>, Edge<TimelineSceneEdgeData>>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypesRef.current}
        edgeTypes={edgeTypesRef.current}
        minZoom={0.2}
        maxZoom={2.8}
        fitView
        fitViewOptions={{ padding: 0.1, maxZoom: 1.15 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        selectionOnDrag={false}
        preventScrolling
        proOptions={{ hideAttribution: true }}
        onInit={setInstance}
        onNodeClick={(_, node) => {
          const data = node.data as TimelineSceneNodeData;
          if (data.kind === "tick" && data.bucket !== undefined && data.nextGranularity) {
            onDrill({ ...bucketQueryRange(data.bucket, scene.granularity), granularity: data.nextGranularity });
            return;
          }
          const item = data.item as TimelineItem | undefined;
          if (item?.object_kind === "node") {
            if (item.object_id === selectedId && selectedSceneNodeId === node.id) {
              clearSelection();
              return;
            }
            onSelectEdge(null);
            setSelectedSceneNodeId(node.id);
            setNodes((current) => current.map((currentNode) => ({ ...currentNode, selected: currentNode.id === node.id })));
            if (item.object_id !== selectedId) onSelect(item);
          }
        }}
        onNodeDoubleClick={(_, node) => {
          const item = node.data.item as TimelineItem | undefined;
          if (item?.object_kind === "node") onOpenObject(item.object_id);
        }}
        onNodeDragStart={(_, node) => {
          const item = node.data.item as TimelineItem | undefined;
          if (item?.object_kind === "node") {
            onSelectEdge(null);
            setSelectedSceneNodeId(node.id);
            onSelect(item);
          }
        }}
        onNodeDragStop={() => setNodes((current) => layoutNodes.map((node) => ({
          ...node,
          selected: current.find((currentNode) => currentNode.id === node.id)?.selected ?? false
        })))}
        onEdgeClick={(_, edge) => {
          if (draggedEdgeIdRef.current === edge.id) {
            draggedEdgeIdRef.current = null;
            return;
          }
          if (selectedEdgeId === edge.id) clearSelection();
          else focusEdge(edge.id);
        }}
        onEdgeDoubleClick={(_, edge) => onOpenObject(edge.id)}
        onPaneClick={clearSelection}
      >
        <Background color="#273240" gap={32} size={1} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable nodeStrokeWidth={2} position="bottom-right" />
      </ReactFlow>
    </section>
  );
}

function TimelinePointNode({ data }: NodeProps) {
  const node = data as TimelineSceneNodeData;
  const item = node.item;
  return (
    <div className="timeline-scene-node timeline-scene-point">
      <Handle id="timeline-target" type="target" position={Position.Left} className="timeline-scene-handle timeline-scene-target-handle" />
      <i className="timeline-scene-dot" />
      <div className="timeline-scene-card"><strong>{node.label}</strong><small>{positionLabel(item)}</small><small>{node.secondary}</small></div>
      <Handle id="timeline-source" type="source" position={Position.Right} className="timeline-scene-handle timeline-scene-source-handle" />
    </div>
  );
}

function TimelineIntervalNode({ data }: NodeProps) {
  const node = data as TimelineSceneNodeData;
  const item = node.item;
  const openStart = item?.position.kind === "interval" && item.position.start === null;
  const openEnd = item?.position.kind === "interval" && item.position.end === null;
  return (
    <div className="timeline-scene-node timeline-scene-interval">
      <Handle id="timeline-target" type="target" position={Position.Left} className="timeline-scene-handle timeline-scene-target-handle" />
      <span className={`timeline-scene-cap ${openStart ? "open" : ""}`} />
      <span className="timeline-scene-life" />
      <span className={`timeline-scene-cap end ${openEnd ? "open" : ""}`} />
      <div className="timeline-scene-card"><strong>{node.label}</strong><small>{positionLabel(item)}</small><small>{node.secondary}</small></div>
      <Handle id="timeline-source" type="source" position={Position.Right} className="timeline-scene-handle timeline-scene-source-handle" />
    </div>
  );
}

function TimelineUndatedNode({ data }: NodeProps) {
  const node = data as TimelineSceneNodeData;
  return (
    <div className="timeline-scene-node timeline-scene-undated">
      <Handle id="timeline-target" type="target" position={Position.Left} className="timeline-scene-handle timeline-scene-target-handle" />
      <i className="timeline-scene-dot" />
      <div className="timeline-scene-card"><strong>{node.label}</strong><small>Undated</small><small>{node.secondary}</small></div>
      <Handle id="timeline-source" type="source" position={Position.Right} className="timeline-scene-handle timeline-scene-source-handle" />
    </div>
  );
}

function TimelineTickNode({ data }: NodeProps) {
  const node = data as TimelineSceneNodeData;
  return <div className="timeline-scene-tick" title={node.nextGranularity ? `${node.label} 범위로 확대` : undefined}><span>{node.label}</span></div>;
}

function TimelineLaneNode({ data }: NodeProps) {
  const node = data as TimelineSceneNodeData;
  return <div className="timeline-scene-lane">{node.label}</div>;
}

function TimelineLineageEdge(props: EdgeProps) {
  const data = props.data as TimelineSceneEdgeData | undefined;
  const { screenToFlowPosition } = useReactFlow();
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [curveOffset, setCurveOffset] = useState(0);
  const dragMovedRef = useRef(false);
  const [path, labelX, labelY] = timelineBezierPath(props.sourceX, props.sourceY, props.targetX, props.targetY, curveOffset);
  const color = data?.color ?? "#6b8db8";
  const emphasized = data?.emphasized === true;
  const selected = data?.selected === true;
  const finishDrag = useCallback(() => {
    setDragStartY(null);
    setCurveOffset(0);
  }, []);

  return <>
    <BaseEdge id={props.id} path={path} interactionWidth={18} style={{ stroke: color, strokeWidth: selected ? 3.4 : emphasized ? 2.8 : 1.35, opacity: emphasized ? 1 : 0.12 }} />
    <path
      className="timeline-scene-edge-drag-target nopan"
      d={path}
      fill="none"
      stroke="transparent"
      strokeWidth={22}
      pointerEvents="stroke"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragMovedRef.current = false;
        setDragStartY(screenToFlowPosition({ x: event.clientX, y: event.clientY }).y);
      }}
      onPointerMove={(event) => {
        if (dragStartY === null) return;
        const offset = screenToFlowPosition({ x: event.clientX, y: event.clientY }).y - dragStartY;
        if (Math.abs(offset) > 2) dragMovedRef.current = true;
        setCurveOffset(offset);
      }}
      onPointerUp={() => {
        const moved = dragMovedRef.current;
        finishDrag();
        if (moved) data?.onFocus?.(props.id);
      }}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}
    />
    {emphasized ? <EdgeLabelRenderer><span className="timeline-scene-edge-label" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`, borderColor: color }}>{data?.relationType}</span></EdgeLabelRenderer> : null}
  </>;
}

function timelineBezierPath(sourceX: number, sourceY: number, targetX: number, targetY: number, curveOffset: number): [string, number, number] {
  const controlDistance = Math.max(72, Math.abs(targetX - sourceX) * 0.25);
  const sourceControlX = sourceX + controlDistance;
  const targetControlX = targetX - controlDistance;
  const sourceControlY = sourceY + curveOffset;
  const targetControlY = targetY + curveOffset;
  const path = `M ${sourceX},${sourceY} C ${sourceControlX},${sourceControlY} ${targetControlX},${targetControlY} ${targetX},${targetY}`;
  const labelX = (sourceX + 3 * sourceControlX + 3 * targetControlX + targetX) / 8;
  const labelY = (sourceY + 3 * sourceControlY + 3 * targetControlY + targetY) / 8;
  return [path, labelX, labelY];
}

function positionLabel(item?: TimelineItem) {
  if (!item || item.position.kind === "undated") return "Undated";
  if (item.position.kind === "point") return item.position.at;
  return `${item.position.start ?? "open"} → ${item.position.end ?? "open"}`;
}
