"use client";

import { useEffect, useMemo, useState } from "react";
import type { ConfidenceBand, LookingForGender, ProfileGender } from "@soft-spark/shared";
import { BandChip } from "./BandChip";
import { tokens } from "./tokens";

export type SearchVizPhase = "idle" | "searching" | "found" | "empty";

type GraphGender = ProfileGender;

type GraphNode = {
  id: string;
  x: number;
  y: number;
  gender: GraphGender;
};

type GraphEdge = { from: string; to: string };

const WIDTH = 320;
const HEIGHT = 280;

function seedNodes(lookingForGender: LookingForGender): GraphNode[] {
  const pool: GraphGender[] =
    lookingForGender === "female"
      ? ["female", "female", "female", "female", "female", "female", "male", "female"]
      : lookingForGender === "male"
        ? ["male", "male", "male", "male", "male", "male", "female", "male"]
        : ["female", "male", "female", "male", "female", "male", "female", "male"];
  const layout = [
    [52, 78],
    [118, 46],
    [196, 62],
    [268, 88],
    [44, 156],
    [132, 138],
    [214, 152],
    [278, 176],
    [86, 222],
    [168, 214],
    [248, 228],
    [160, 86],
  ] as const;
  return layout.map(([x, y], i) => ({
    id: `n${i}`,
    x,
    y,
    gender: pool[i % pool.length]!,
  }));
}

function seedEdges(nodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const a = nodes[i]!;
    const nearest = nodes
      .filter((b) => b.id !== a.id)
      .sort((b, c) => dist(a, b) - dist(a, c))
      .slice(0, 2);
    for (const b of nearest) {
      const key = [a.id, b.id].sort().join("-");
      if (!edges.some((e) => [e.from, e.to].sort().join("-") === key)) {
        edges.push({ from: a.id, to: b.id });
      }
    }
  }
  return edges;
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SearchVizPanel(props: {
  phase: SearchVizPhase;
  lookingForGender?: LookingForGender;
  youGender?: ProfileGender | string;
  band?: ConfidenceBand;
  etaSeconds?: number;
  remainingSeconds?: number;
  onSearch?: () => void;
  disabled?: boolean;
  botName?: string;
}) {
  const lookingForGender = props.lookingForGender ?? "both";
  const nodes = useMemo(() => seedNodes(lookingForGender), [lookingForGender]);
  const edges = useMemo(() => seedEdges(nodes), [nodes]);
  const targets = useMemo(() => {
    if (lookingForGender === "both") return nodes;
    return nodes.filter((n) => n.gender === lookingForGender);
  }, [lookingForGender, nodes]);

  const [hopIndex, setHopIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const reduced = prefersReducedMotion();
  const searching = props.phase === "searching";
  const hopMs = tokens.graph.hopMs;

  useEffect(() => {
    if (!searching || reduced || targets.length < 2) {
      setProgress(0);
      return;
    }
    let frame = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / hopMs);
      setProgress(t);
      if (t >= 1) {
        setHopIndex((i) => (i + 1) % targets.length);
        start = now;
        setProgress(0);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [searching, reduced, targets.length, hopMs]);

  const from = targets[hopIndex % Math.max(targets.length, 1)] ?? nodes[0]!;
  const to = targets[(hopIndex + 1) % Math.max(targets.length, 1)] ?? nodes[1] ?? nodes[0]!;
  const you = {
    x: searching && !reduced ? lerp(from.x, to.x, progress) : from.x,
    y: searching && !reduced ? lerp(from.y, to.y, progress) : from.y,
  };

  const title =
    props.phase === "found"
      ? "Your bot found someone"
      : props.phase === "empty"
        ? "Still looking"
        : "Your bot is out";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        className="ss-graph-well"
        role="img"
        aria-label={
          searching
            ? "Network of nearby bots. Your bot hops from node to node while searching."
            : "Dating-pool graph"
        }
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="100%" aria-hidden>
          {edges.map((edge) => {
            const a = nodes.find((n) => n.id === edge.from)!;
            const b = nodes.find((n) => n.id === edge.to)!;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={tokens.graph.edge}
                strokeWidth="1.4"
              />
            );
          })}
          {searching ? (
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={tokens.graph.youRing}
              strokeWidth="2.2"
              strokeDasharray="5 6"
              opacity={0.85}
            />
          ) : null}
          {nodes.map((node) => (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={7}
              fill={node.gender === "female" ? tokens.graph.female : tokens.graph.male}
            />
          ))}
          <circle cx={you.x} cy={you.y} r={13} fill="none" stroke={tokens.graph.youRing} strokeWidth="3" />
          <circle cx={you.x} cy={you.y} r={8.5} fill={tokens.graph.you} />
        </svg>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <h2 style={{ fontFamily: "var(--ss-font-display)", fontSize: 26, margin: 0 }}>{title}</h2>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
          {props.phase === "found"
            ? "Invite is ready — status only, no chat."
            : props.phase === "empty"
              ? "No active matches yet — your bot’s exploring"
              : searching
                ? `${props.botName?.trim() || "Your bot"} is hopping the pool. Pink is female, blue is male.`
                : "Send your bot into the pool. You’ll only see a status band and an invite."}
        </p>
        {searching && props.remainingSeconds != null ? (
          <p style={{ margin: 0, fontSize: 14 }} aria-live="polite">
            Usually {Math.max(8, (props.etaSeconds ?? 16) - 6)}–{props.etaSeconds ?? 16} seconds
            {props.remainingSeconds > 0 ? ` · about ${props.remainingSeconds}s left` : " · wrapping up…"}
          </p>
        ) : null}
        <div className="ss-graph-footer">
          <BandChip band={props.band ?? (props.phase === "found" ? "invite_ready" : searching ? "building" : "low")} />
        </div>
        {props.phase === "idle" || props.phase === "empty" ? (
          <button
            type="button"
            className="ss-btn ss-btn-primary"
            disabled={props.disabled}
            onClick={props.onSearch}
          >
            Roam / find a match
          </button>
        ) : null}
      </div>
    </div>
  );
}
