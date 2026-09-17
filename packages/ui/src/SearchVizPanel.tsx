"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeGender } from "@soft-spark/shared";
import type { ConfidenceBand, LookingForGender, ProfileGender } from "@soft-spark/shared";
import { BandChip } from "./BandChip";
import { tokens } from "./tokens";

export type SearchVizPhase = "idle" | "searching" | "found" | "empty";

type GraphGender = ProfileGender;
type GraphNode = {
  id: string;
  x: number;
  y: number;
  r: number;
  gender: GraphGender;
  hub?: boolean;
  isolated?: boolean;
};
type GraphEdge = { from: string; to: string };

const WIDTH = 320;
const HEIGHT = 280;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickGender(rand: () => number, lookingForGender: LookingForGender, preferTarget: boolean): GraphGender {
  if (lookingForGender === "both") return rand() > 0.5 ? "female" : "male";
  if (preferTarget) return rand() > 0.18 ? lookingForGender : lookingForGender === "female" ? "male" : "female";
  return rand() > 0.55 ? lookingForGender : lookingForGender === "female" ? "male" : "female";
}

function seedGraph(lookingForGender: LookingForGender): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const rand = mulberry32(lookingForGender === "female" ? 11 : lookingForGender === "male" ? 23 : 37);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const clusters = [
    { cx: 92, cy: 118, count: 20, hubR: 5.6 },
    { cx: 158, cy: 148, count: 14, hubR: 5.2 },
    { cx: 236, cy: 72, count: 11, hubR: 4.8 },
    { cx: 248, cy: 188, count: 16, hubR: 5.4 },
  ] as const;

  clusters.forEach((cluster, ci) => {
    const hubId = `h${ci}`;
    nodes.push({
      id: hubId,
      x: cluster.cx,
      y: cluster.cy,
      r: cluster.hubR,
      gender: pickGender(rand, lookingForGender, true),
      hub: true,
    });
    for (let i = 0; i < cluster.count; i++) {
      const angle = (i / cluster.count) * Math.PI * 2 + rand() * 0.22;
      const dist = 22 + rand() * 38 + (i % 3) * 6;
      const id = `c${ci}n${i}`;
      nodes.push({
        id,
        x: cluster.cx + Math.cos(angle) * dist,
        y: cluster.cy + Math.sin(angle) * dist,
        r: 2.4 + rand() * 1.4,
        gender: pickGender(rand, lookingForGender, true),
      });
      edges.push({ from: hubId, to: id });
      if (i > 0 && rand() > 0.55) edges.push({ from: `c${ci}n${i - 1}`, to: id });
    }
  });

  edges.push({ from: "h0", to: "h1" }, { from: "h1", to: "h3" }, { from: "h2", to: "h3" });

  for (let i = 0; i < 18; i++) {
    const side = rand();
    const x = side < 0.35 ? 14 + rand() * 36 : side < 0.7 ? 270 + rand() * 36 : 40 + rand() * 240;
    const y = side < 0.35 ? 18 + rand() * 244 : side < 0.7 ? 16 + rand() * 248 : rand() > 0.5 ? 14 + rand() * 28 : 250 + rand() * 22;
    nodes.push({
      id: `iso${i}`,
      x,
      y,
      r: 2.1 + rand() * 0.8,
      gender: pickGender(rand, lookingForGender, false),
      isolated: true,
    });
  }

  return { nodes, edges };
}

function neighborsOf(id: string, edges: GraphEdge[]): string[] {
  const out: string[] = [];
  for (const edge of edges) {
    if (edge.from === id) out.push(edge.to);
    if (edge.to === id) out.push(edge.from);
  }
  return out;
}

function hopCycle(nodes: GraphNode[], edges: GraphEdge[], lookingForGender: LookingForGender): GraphNode[] {
  const targets = nodes.filter((n) => !n.isolated && (lookingForGender === "both" || n.gender === lookingForGender));
  const pool = targets.length >= 4 ? targets : nodes.filter((n) => !n.isolated);
  if (pool.length === 0) return nodes.slice(0, 2);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const start = pool[0]!;
  const path: GraphNode[] = [start];
  const seen = new Set([start.id]);
  let cursor = start.id;
  for (let step = 0; step < 10; step++) {
    let next: GraphNode | undefined;
    for (const id of neighborsOf(cursor, edges)) {
      const candidate = byId.get(id);
      if (!candidate || seen.has(candidate.id)) continue;
      if (lookingForGender !== "both" && candidate.gender !== lookingForGender) continue;
      next = candidate;
      break;
    }
    if (!next) break;
    path.push(next);
    seen.add(next.id);
    cursor = next.id;
  }
  if (path.length < 2) {
    const fallback = pool[1] ?? nodes.find((n) => n.id !== start.id);
    if (fallback) path.push(fallback);
  }
  return path;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
  compact?: boolean;
  /** Live matches mapped onto targetable nodes. Tap opens match detail (bands only). */
  targets?: Array<{ id: string }>;
  onSelectTarget?: (id: string) => void;
}) {
  const lookingForGender = props.lookingForGender ?? "both";
  const youGender = normalizeGender(props.youGender) ?? "female";
  const youFill = youGender === "male" ? tokens.graph.male : tokens.graph.female;
  const { nodes, edges } = useMemo(() => seedGraph(lookingForGender), [lookingForGender]);
  const cycle = useMemo(() => hopCycle(nodes, edges, lookingForGender), [nodes, edges, lookingForGender]);
  const [hopIndex, setHopIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const reduced = prefersReducedMotion();
  const searching = props.phase === "searching";
  const hopMs = tokens.graph.hopMs;
  const targetable = (gender: GraphGender) => lookingForGender === "both" || gender === lookingForGender;
  const targetByNode = useMemo(() => {
    const map = new Map<string, string>();
    const slots = nodes.filter((n) => !n.isolated && (lookingForGender === "both" || n.gender === lookingForGender));
    (props.targets ?? []).forEach((target, i) => {
      const slot = slots[i];
      if (slot) map.set(slot.id, target.id);
    });
    return map;
  }, [nodes, props.targets, lookingForGender]);

  useEffect(() => {
    if (!searching || reduced || cycle.length < 2) {
      setProgress(0);
      return;
    }
    let frame = 0;
    let start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / hopMs);
      setProgress(t);
      if (t >= 1) {
        setHopIndex((i) => (i + 1) % cycle.length);
        start = now;
        setProgress(0);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [searching, reduced, cycle.length, hopMs]);

  const from = cycle[hopIndex % cycle.length] ?? nodes[0]!;
  const to = cycle[(hopIndex + 1) % cycle.length] ?? cycle[0] ?? nodes[1] ?? nodes[0]!;
  const t = easeInOut(progress);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const bounce = searching && !reduced ? Math.sin(progress * Math.PI) * Math.min(16, len * 0.22) : 0;
  const you = {
    x: searching && !reduced ? lerp(from.x, to.x, t) + (-dy / len) * bounce : from.x,
    y: searching && !reduced ? lerp(from.y, to.y, t) + (dx / len) * bounce : from.y,
  };

  const title =
    props.phase === "found"
      ? "Your bot found someone"
      : props.phase === "empty"
        ? "Still looking"
        : searching
          ? "Looking for dates…"
          : "Your bot is out";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        className={props.compact ? "ss-graph-well ss-graph-well-compact" : "ss-graph-well"}
        style={{
          background: tokens.graph.well,
          borderRadius: 22,
          height: props.compact ? 148 : 280,
          overflow: "hidden",
        }}
        role={props.targets?.length ? "group" : "img"}
        aria-label={
          searching
            ? `Network of nearby bots. Pink is female, blue is male. Filtered-out genders are grey. Your bot hops toward ${lookingForGender === "both" ? "everyone" : lookingForGender}.`
            : "Dating-pool graph. Pink is female, blue is male. Grey nodes are filtered out by lookingForGender."
        }
      >
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height="100%" aria-hidden={props.targets?.length ? undefined : true}>
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
                strokeWidth="1"
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
              strokeWidth="1.6"
              strokeDasharray="4 5"
              opacity={0.7}
            />
          ) : null}
          {nodes.map((node) => {
            const open = targetable(node.gender);
            const matchId = targetByNode.get(node.id);
            return (
              <g
                key={node.id}
                role={matchId ? "button" : undefined}
                tabIndex={matchId ? 0 : undefined}
                aria-label={
                  open
                    ? matchId
                      ? `Open match — ${node.gender}`
                      : `${node.gender} bot`
                    : `${node.gender} bot, filtered out`
                }
                style={{ cursor: open ? (matchId ? "pointer" : "default") : "not-allowed" }}
                onClick={() => {
                  if (!open || !matchId) return;
                  props.onSelectTarget?.(matchId);
                }}
                onKeyDown={(event) => {
                  if (!open || !matchId) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    props.onSelectTarget?.(matchId);
                  }
                }}
              >
                <circle cx={node.x} cy={node.y} r={Math.max(node.r, 8)} fill="transparent" />
                {matchId ? (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r + 3.4}
                    fill="none"
                    stroke={tokens.graph.youRing}
                    strokeWidth="1.4"
                  />
                ) : null}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.r}
                  fill={open ? (node.gender === "female" ? tokens.graph.female : tokens.graph.male) : tokens.graph.filtered}
                  opacity={open ? (node.isolated ? 0.7 : 1) : 0.4}
                />
              </g>
            );
          })}
          <circle cx={you.x} cy={you.y} r={11} fill="none" stroke={tokens.graph.youRing} strokeWidth="2.5" />
          <circle cx={you.x} cy={you.y} r={6.5} fill={youFill} />
        </svg>
      </div>
      {props.compact ? (
        <p style={{ margin: 0, color: "var(--ss-text-muted)", fontSize: 13 }}>Roaming</p>
      ) : (
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={{ fontFamily: "var(--ss-font-display)", fontSize: 26, margin: 0 }}>{title}</h1>
        <p style={{ margin: 0, color: "var(--ss-text-muted)", lineHeight: 1.45 }}>
          {props.phase === "found"
            ? "Invite is ready — status only, no chat."
            : props.phase === "empty"
              ? "Your bot is out — we’ll ping you when chemistry builds"
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
      )}
    </div>
  );
}
