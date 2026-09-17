"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ConfidenceBand, LookingForGender, ProfileGender } from "@soft-spark/shared";
import { BandChip } from "./BandChip";
import { tokens } from "./tokens";

export type SearchVizPhase = "idle" | "searching" | "found" | "empty";
export type SearchVizStatus = "searching" | "building" | "strong" | "invite_ready" | "paused";

type GraphGender = ProfileGender;
type GraphNode = {
  x: number;
  y: number;
  r: number;
  gender: GraphGender;
  hub?: boolean;
};
type GraphEdge = { a: number; b: number };

const WIDTH = 358;
const HEIGHT = 520;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedNumber(seed: string | undefined, lookingForGender: LookingForGender) {
  if (seed) {
    let n = 0;
    for (let i = 0; i < seed.length; i++) n = (n * 33 + seed.charCodeAt(i)) >>> 0;
    return n || 0xc0ffee;
  }
  return lookingForGender === "female" ? 0xc0ff11 : lookingForGender === "male" ? 0xc0ff22 : 0xc0ffee;
}

function pickCohort(rand: () => number, lookingForGender: LookingForGender, hubIndex?: number): GraphGender {
  if (lookingForGender === "male" || lookingForGender === "female") return lookingForGender;
  if (hubIndex != null) return hubIndex % 2 ? "female" : "male";
  return rand() > 0.48 ? "female" : "male";
}

/** Aura mock silhouette: 3 hubs + ~52 periphery. Non-target genders omitted. */
function seedGraph(lookingForGender: LookingForGender, seed?: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const rand = mulberry32(seedNumber(seed, lookingForGender));
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const hubs = [
    { x: WIDTH * 0.32, y: HEIGHT * 0.28, r: 14 },
    { x: WIDTH * 0.48, y: HEIGHT * 0.38, r: 13 },
    { x: WIDTH * 0.68, y: HEIGHT * 0.42, r: 12 },
  ];
  hubs.forEach((h, i) => {
    nodes.push({
      ...h,
      gender: pickCohort(rand, lookingForGender, i),
      hub: true,
    });
  });
  for (let i = 0; i < 52; i++) {
    const a = rand() * Math.PI * 2;
    const rad = 0.18 + rand() * 0.38;
    nodes.push({
      x: WIDTH * (0.5 + Math.cos(a) * rad * 0.95),
      y: HEIGHT * (0.48 + Math.sin(a) * rad * 0.85),
      r: 5 + rand() * 2,
      gender: pickCohort(rand, lookingForGender),
    });
  }

  const seen = new Set<string>();
  const link = (a: number, b: number) => {
    if (a === b) return;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ a, b });
  };
  link(0, 1);
  link(1, 2);
  link(0, 2);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]!;
    const dist = nodes
      .map((m, j) => ({ j, d: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 }))
      .filter((o) => o.j !== i)
      .sort((u, v) => u.d - v.d);
    const k = n.hub ? 8 : 2 + (rand() > 0.7 ? 1 : 0);
    for (let t = 0; t < k; t++) {
      const next = dist[t];
      if (next) link(i, next.j);
    }
  }
  for (let h = 0; h < 3; h++) {
    for (let t = 0; t < 10; t++) link(h, 3 + ((h * 11 + t * 5) % (nodes.length - 3)));
  }
  return { nodes, edges };
}

function neighborsOf(index: number, edges: GraphEdge[]): number[] {
  const out: number[] = [];
  for (const edge of edges) {
    if (edge.a === index) out.push(edge.b);
    if (edge.b === index) out.push(edge.a);
  }
  return out;
}

function pickNext(
  cur: number,
  prev: number,
  nodes: GraphNode[],
  edges: GraphEdge[],
  lookingForGender: LookingForGender,
  rand: () => number
): number {
  const ns = neighborsOf(cur, edges).filter((n) => n !== prev);
  const pool = ns.length ? ns : neighborsOf(cur, edges);
  const preferred =
    lookingForGender === "both" ? pool : pool.filter((i) => nodes[i]?.gender === lookingForGender);
  const use = preferred.length ? preferred : pool;
  if (!use.length) return cur;
  return use[Math.floor(rand() * use.length)] ?? cur;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function statusFrom(props: {
  status?: SearchVizStatus;
  phase?: SearchVizPhase;
  band?: ConfidenceBand;
}): SearchVizStatus {
  if (props.status) return props.status;
  if (props.band === "invite_ready" || props.phase === "found") return "invite_ready";
  if (props.band === "strong") return "strong";
  if (props.phase === "searching" || props.band === "building") return "building";
  if (props.phase === "idle" || props.phase === "empty") return "paused";
  return "searching";
}

export function SearchVizPanel(props: {
  phase?: SearchVizPhase;
  status?: SearchVizStatus;
  seed?: string;
  lookingForGender?: LookingForGender;
  youGender?: ProfileGender | string;
  band?: ConfidenceBand;
  etaSeconds?: number;
  remainingSeconds?: number;
  onSearch?: () => void;
  disabled?: boolean;
  botName?: string;
  compact?: boolean;
  reducedMotion?: boolean;
  targets?: Array<{ id: string }>;
  onSelectTarget?: (id: string) => void;
}) {
  const lookingForGender = props.lookingForGender ?? "both";
  const status = statusFrom(props);
  const { nodes, edges } = useMemo(
    () => seedGraph(lookingForGender, props.seed),
    [lookingForGender, props.seed]
  );
  const hopRand = useRef(mulberry32(seedNumber(props.seed, lookingForGender) ^ 0x9e3779b9));
  const hop = useRef({ from: 1, to: 1, progress: 1, dwell: 0, prev: -1 });
  const [tick, setTick] = useState(0);
  const [reducedLive, setReducedLive] = useState(false);
  const reducedProp = props.reducedMotion;
  const reduced = reducedProp ?? reducedLive;
  const hopping = !reduced && (status === "searching" || status === "building" || status === "strong");
  const tweenMs = status === "strong" ? 1100 : tokens.graph.tweenMs;
  const dwellMs = status === "strong" ? 420 : tokens.graph.dwellMs;
  const vignetteId = `ss-graph-vignette-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedLive(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    hopRand.current = mulberry32(seedNumber(props.seed, lookingForGender) ^ 0x9e3779b9);
    hop.current = { from: 1, to: 1, progress: 1, dwell: 0, prev: -1 };
    setTick((n) => n + 1);
  }, [lookingForGender, props.seed]);

  useEffect(() => {
    if (hopping || (status === "invite_ready" && !reduced)) {
      let frame = 0;
      let last = performance.now();
      const step = (now: number) => {
        const dt = Math.min(48, now - last);
        last = now;
        if (hopping && nodes.length >= 2) {
          const h = hop.current;
          if (h.progress < 1) {
            h.progress = Math.min(1, h.progress + dt / tweenMs);
          } else if (h.dwell < dwellMs) {
            h.dwell += dt;
          } else {
            h.prev = h.from;
            h.from = h.to;
            h.to = pickNext(h.from, h.prev, nodes, edges, lookingForGender, hopRand.current);
            h.progress = 0;
            h.dwell = 0;
          }
        }
        setTick((n) => n + 1);
        frame = window.requestAnimationFrame(step);
      };
      frame = window.requestAnimationFrame(step);
      return () => window.cancelAnimationFrame(frame);
    }
    return undefined;
  }, [hopping, status, reduced, nodes, edges, lookingForGender, tweenMs, dwellMs]);

  const fromNode = nodes[hop.current.from] ?? nodes[1] ?? nodes[0]!;
  const toNode = nodes[hop.current.to] ?? fromNode;
  const t = easeInOut(Math.min(1, hop.current.progress));
  const parked = !hopping || reduced;
  const you = {
    x: parked ? fromNode.x : lerp(fromNode.x, toNode.x, t),
    y: parked ? fromNode.y : lerp(fromNode.y, toNode.y, t),
  };
  const dwellPulse = hopping && hop.current.progress >= 1 ? 1 + Math.sin(hop.current.dwell / 80) * 0.04 : 1;
  const invitePulse = status === "invite_ready" && !reduced ? 1 + Math.sin(tick / 8) * 0.06 : 1;
  const youScale = hopping ? dwellPulse : invitePulse;
  const band: ConfidenceBand =
    props.band ??
    (status === "invite_ready" ? "invite_ready" : status === "strong" ? "strong" : status === "paused" ? "low" : "building");

  const title = reduced ? "Searching the pool" : "Your bot is out";
  const sub =
    props.phase === "empty" || props.phase === "idle"
      ? "Warming up the graph…"
      : reduced
        ? "Searching the pool"
        : "Exploring the dating pool";

  const well = (
    <div
      className={props.compact ? "ss-graph-well ss-graph-well-compact" : "ss-graph-well"}
      style={{
        background: tokens.graph.well,
        borderRadius: 22,
        height: props.compact ? 148 : 420,
        overflow: "hidden",
        padding: 12,
        boxSizing: "border-box",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04)",
      }}
      role="img"
      aria-label={
        hopping
          ? `Dating-pool graph. Your bot hops toward ${lookingForGender === "both" ? "everyone" : lookingForGender}. Pink is female, blue is male. Status only, no chat.`
          : `Dating-pool graph. Pink is female, blue is male. ${lookingForGender === "both" ? "Showing everyone." : `Showing ${lookingForGender} only.`} Status only, no chat.`
      }
    >
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="100%" aria-hidden>
        <defs>
          <radialGradient id={vignetteId} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="rgba(232,165,152,0.05)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>
        <rect width={WIDTH} height={HEIGHT} fill={tokens.graph.well} />
        <rect width={WIDTH} height={HEIGHT} fill={`url(#${vignetteId})`} />
        {edges.map((edge) => {
          const a = nodes[edge.a]!;
          const b = nodes[edge.b]!;
          const active =
            hopping &&
            ((edge.a === hop.current.from && edge.b === hop.current.to) ||
              (edge.b === hop.current.from && edge.a === hop.current.to));
          return (
            <line
              key={`${edge.a}-${edge.b}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={active ? tokens.graph.edgeActive : tokens.graph.edgeIdle}
              strokeWidth={active ? 2.5 : 1}
            />
          );
        })}
        {nodes.map((node, i) => (
          <circle
            key={i}
            cx={node.x}
            cy={node.y}
            r={node.r}
            fill={node.gender === "female" ? tokens.graph.female : tokens.graph.male}
            opacity={node.hub ? 1 : 0.55}
          />
        ))}
        <circle
          cx={you.x}
          cy={you.y}
          r={17 * youScale}
          fill={tokens.graph.you}
          stroke={tokens.graph.youRing}
          strokeWidth={status === "strong" || status === "invite_ready" ? 3.2 : 2}
        />
        <text
          x={you.x}
          y={you.y + 32}
          textAnchor="middle"
          fill={tokens.graph.label}
          fontSize={10}
          fontFamily='Inter, "SF Pro Text", system-ui, sans-serif'
          fontWeight={500}
        >
          you
        </text>
      </svg>
    </div>
  );

  if (props.compact) {
    return <div style={{ display: "grid", gap: 10 }}>{well}</div>;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gap: 4 }}>
        <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 26, fontWeight: 600, margin: 0, lineHeight: 1.15 }}>
          {title}
        </h1>
        <p className="ss-graph-sub" style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 14 }}>
          {sub}
        </p>
      </div>
      {well}
      <div className="ss-graph-footer">
        <BandChip band={band} />
        <span className="ss-graph-hint">{status === "paused" ? "Paused" : "Looking for chemistry"}</span>
      </div>
      {props.phase === "idle" || props.phase === "empty" ? (
        <button type="button" className="ss-btn ss-btn-primary" disabled={props.disabled} onClick={props.onSearch}>
          Roam / find a match
        </button>
      ) : null}
    </div>
  );
}
