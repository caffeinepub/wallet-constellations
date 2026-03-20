import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { GraphEdge, GraphNode } from "../types";

// --- Force simulation types ---
type SimNode = GraphNode & { x: number; y: number; vx: number; vy: number };

// Colors (raw hex for SVG drawing context – allowed per design-system rules)
const COLOR_CENTER = "#4AA8FF";
const COLOR_NODE = "#66C7FF";
const COLOR_EDGE = "#66C7FF";
const COLOR_TEXT = "#9FB0C8";
const COLOR_STAR = "#ffffff";

const REPULSION = 7000;
const SPRING_LEN = 190;
const SPRING_K = 0.05;
const GRAVITY = 0.004;
const DAMPING = 0.76;

function runStep(
  nodes: SimNode[],
  edges: GraphEdge[],
  cx: number,
  cy: number,
  alpha: number,
  w: number,
  h: number,
) {
  const padding = 50;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].isCenter) continue;
    for (let j = 0; j < nodes.length; j++) {
      if (i === j) continue;
      const dx = nodes[i].x - nodes[j].x || 0.001;
      const dy = nodes[i].y - nodes[j].y || 0.001;
      const dist2 = dx * dx + dy * dy + 1;
      const dist = Math.sqrt(dist2);
      const f = (REPULSION * alpha) / dist2;
      nodes[i].vx += (f * dx) / dist;
      nodes[i].vy += (f * dy) / dist;
    }
  }
  for (const edge of edges) {
    const src = nodes.find((n) => n.id === edge.source);
    const tgt = nodes.find((n) => n.id === edge.target);
    if (!src || !tgt) continue;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) + 0.001;
    const f = (dist - SPRING_LEN) * SPRING_K * alpha;
    if (!src.isCenter) {
      src.vx += (f * dx) / dist;
      src.vy += (f * dy) / dist;
    }
    if (!tgt.isCenter) {
      tgt.vx -= (f * dx) / dist;
      tgt.vy -= (f * dy) / dist;
    }
  }
  for (const n of nodes) {
    if (n.isCenter) {
      n.x = cx;
      n.y = cy;
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    n.vx += (cx - n.x) * GRAVITY * alpha;
    n.vy += (cy - n.y) * GRAVITY * alpha;
    n.vx *= DAMPING;
    n.vy *= DAMPING;
    n.x += n.vx;
    n.y += n.vy;
    n.x = Math.max(padding, Math.min(w - padding, n.x));
    n.y = Math.max(padding, Math.min(h - padding, n.y));
  }
}

function shortenId(id: string) {
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

// Seeded star positions for consistent renders
const STARS = (() => {
  let s = 42;
  const rand = () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  return Array.from({ length: 180 }, (_, idx) => ({
    idx,
    x: rand() * 100,
    y: rand() * 100,
    r: rand() * 1.3 + 0.3,
    op: rand() * 0.5 + 0.1,
  }));
})();

interface TooltipState {
  screenX: number;
  screenY: number;
  node: SimNode;
}

interface ConstellationGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  centerPrincipal: string;
  onNavigate: (principal: string) => void;
  edgeWeight: "tx_count" | "total_amount";
  maxCounterparties: number;
  onMaxCounterpartiesChange: (v: number) => void;
  isEmpty?: boolean;
}

export function ConstellationGraph({
  nodes: propNodes,
  edges: propEdges,
  onNavigate,
  edgeWeight,
  maxCounterparties,
  onMaxCounterpartiesChange,
  isEmpty = false,
}: ConstellationGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(520);
  const simRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>(propEdges);
  edgesRef.current = propEdges;
  const widthRef = useRef(width);
  const heightRef = useRef(height);
  widthRef.current = width;
  heightRef.current = height;
  const propNodesRef = useRef(propNodes);
  propNodesRef.current = propNodes;
  const [, forceRender] = useState(0);
  const rafRef = useRef(0);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [edgeMode, setEdgeMode] = useState<"tx_count" | "total_amount">(
    edgeWeight,
  );

  // Track resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setWidth(el.offsetWidth);
      setHeight(el.offsetHeight);
    });
    ro.observe(el);
    setWidth(el.offsetWidth);
    setHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  const nodeKey = propNodes.map((n) => n.id).join(",");

  const runSim = () => {
    cancelAnimationFrame(rafRef.current);
    const w = widthRef.current;
    const h = heightRef.current;
    const cx = w / 2;
    const cy = h / 2;
    const pn = propNodesRef.current;
    const nonCenter = pn.filter((n) => !n.isCenter);
    simRef.current = pn.map((n, i) => {
      if (n.isCenter) return { ...n, x: cx, y: cy, vx: 0, vy: 0 };
      const angle = (2 * Math.PI * (i - 1)) / Math.max(nonCenter.length, 1);
      const rad = Math.min(w, h) * 0.28;
      return {
        ...n,
        x: cx + rad * Math.cos(angle),
        y: cy + rad * Math.sin(angle),
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
      };
    });

    let alpha = 1.0;
    let frame = 0;
    const tick = () => {
      runStep(simRef.current, edgesRef.current, cx, cy, alpha, w, h);
      alpha *= 0.981;
      frame++;
      if (frame % 2 === 0) forceRender((c) => c + 1);
      if (alpha > 0.004 && frame < 600) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        forceRender((c) => c + 1);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Restart sim when nodes or dimensions change
  // biome-ignore lint/correctness/useExhaustiveDependencies: runSim reads from refs intentionally
  useEffect(() => {
    runSim();
    return () => cancelAnimationFrame(rafRef.current);
  }, [nodeKey, width, height]);

  const ns = simRef.current;

  const maxWeight = useMemo(() => {
    const vals = propEdges.map((e) =>
      edgeMode === "tx_count" ? e.tx_count : e.total_amount,
    );
    return Math.max(...vals, 1);
  }, [propEdges, edgeMode]);

  // Welcome decorative stars if empty
  const decorStars = useMemo(() => {
    if (!isEmpty) return [];
    let s2 = 99;
    const r2 = () => {
      s2 = (s2 * 1664525 + 1013904223) & 0x7fffffff;
      return s2 / 0x7fffffff;
    };
    return Array.from({ length: 30 }, (_, idx) => ({
      idx,
      x: r2() * 100,
      y: r2() * 100,
      r: r2() * 3 + 1,
      op: r2() * 0.4 + 0.15,
    }));
  }, [isEmpty]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden rounded-lg border border-border bg-card"
      data-ocid="wallet.canvas_target"
    >
      <svg
        width={width}
        height={height}
        className="absolute inset-0"
        style={{ display: "block" }}
        role="img"
        aria-label="ICP wallet transaction network constellation"
      >
        <title>ICP Wallet Transaction Network</title>
        <defs>
          <filter id="glow-center" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-node" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="glow-edge" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="center-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7DD3FF" stopOpacity="1" />
            <stop offset="60%" stopColor="#4AA8FF" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2280DD" stopOpacity="0.6" />
          </radialGradient>
          <radialGradient id="node-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#88D8FF" stopOpacity="1" />
            <stop offset="100%" stopColor="#4AA8FF" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id="node-grad-alt" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFD080" stopOpacity="1" />
            <stop offset="100%" stopColor="#F0B35A" stopOpacity="0.7" />
          </radialGradient>
        </defs>

        {/* Background stars */}
        {STARS.map((star) => (
          <circle
            key={star.idx}
            cx={(star.x / 100) * width}
            cy={(star.y / 100) * height}
            r={star.r}
            fill={COLOR_STAR}
            opacity={star.op * 0.35}
          />
        ))}

        {/* Decorative stars when empty */}
        {isEmpty &&
          decorStars.map((star) => (
            <circle
              key={star.idx}
              cx={(star.x / 100) * width}
              cy={(star.y / 100) * height}
              r={star.r}
              fill={COLOR_NODE}
              opacity={star.op}
            />
          ))}

        {/* Edges */}
        {ns.length > 0 &&
          propEdges.map((edge) => {
            const src = ns.find((n) => n.id === edge.source);
            const tgt = ns.find((n) => n.id === edge.target);
            if (!src || !tgt) return null;
            const w =
              edgeMode === "tx_count" ? edge.tx_count : edge.total_amount;
            const ratio = w / maxWeight;
            const opacity = 0.15 + 0.55 * ratio;
            const strokeW = 0.5 + 2 * ratio;
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const cpx = (src.x + tgt.x) / 2 + dy * 0.22;
            const cpy = (src.y + tgt.y) / 2 - dx * 0.22;
            return (
              <path
                key={`${edge.source}-${edge.target}`}
                d={`M ${src.x} ${src.y} Q ${cpx} ${cpy} ${tgt.x} ${tgt.y}`}
                fill="none"
                stroke={COLOR_EDGE}
                strokeWidth={strokeW}
                opacity={opacity}
                filter="url(#glow-edge)"
              />
            );
          })}

        {/* Nodes */}
        {ns.map((node) => {
          const isCenter = node.isCenter;
          const r = isCenter
            ? 26
            : Math.max(7, Math.min(18, 7 + node.txCount * 0.8));
          const useAlt = !isCenter && node.id.charCodeAt(0) % 3 === 0;
          return (
            <g
              key={node.id}
              transform={`translate(${node.x}, ${node.y})`}
              style={{ cursor: isCenter ? "default" : "pointer" }}
              onClick={() => {
                if (!isCenter) onNavigate(node.id);
              }}
              onKeyDown={(e) => {
                if (!isCenter && (e.key === "Enter" || e.key === " ")) {
                  onNavigate(node.id);
                }
              }}
              role={isCenter ? undefined : "button"}
              tabIndex={isCenter ? undefined : 0}
              onMouseEnter={(e) =>
                setTooltip({ screenX: e.clientX, screenY: e.clientY, node })
              }
              onMouseLeave={() => setTooltip(null)}
              onMouseMove={(e) =>
                setTooltip((t) =>
                  t ? { ...t, screenX: e.clientX, screenY: e.clientY } : null,
                )
              }
              data-ocid={isCenter ? "wallet.canvas_target" : "wallet.button"}
            >
              {isCenter ? (
                <>
                  <circle
                    r={r + 18}
                    fill="none"
                    stroke={COLOR_CENTER}
                    strokeWidth={0.8}
                    opacity={0.15}
                  />
                  <circle
                    r={r + 10}
                    fill="none"
                    stroke={COLOR_CENTER}
                    strokeWidth={0.8}
                    opacity={0.25}
                  />
                  <circle
                    r={r}
                    fill="url(#center-grad)"
                    filter="url(#glow-center)"
                  />
                </>
              ) : (
                <circle
                  r={r}
                  fill={useAlt ? "url(#node-grad-alt)" : "url(#node-grad)"}
                  fillOpacity={0.85}
                  filter="url(#glow-node)"
                />
              )}
              <text
                y={r + 14}
                textAnchor="middle"
                fill={COLOR_TEXT}
                fontSize="10"
                fontFamily="'Plus Jakarta Sans', sans-serif"
                pointerEvents="none"
              >
                {shortenId(node.id)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Controls overlay */}
      <div className="absolute top-3 right-3 flex flex-col gap-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            data-ocid="wallet.toggle"
            onClick={() => setEdgeMode("tx_count")}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              edgeMode === "tx_count"
                ? "bg-neon-blue/20 border-neon-blue/50 text-neon-blue"
                : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Count
          </button>
          <button
            type="button"
            data-ocid="wallet.toggle"
            onClick={() => setEdgeMode("total_amount")}
            className={`text-xs px-2 py-1 rounded border transition-colors ${
              edgeMode === "total_amount"
                ? "bg-neon-amber/20 border-neon-amber/50 text-neon-amber"
                : "bg-muted/50 border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Volume
          </button>
        </div>

        {/* Max counterparties slider */}
        <div className="bg-card/80 border border-border rounded p-2 backdrop-blur-sm w-36">
          <div className="text-xs text-muted-foreground mb-1.5">
            Nodes: {maxCounterparties}
          </div>
          <Slider
            min={5}
            max={50}
            step={5}
            value={[maxCounterparties]}
            onValueChange={([v]) => onMaxCounterpartiesChange(v)}
            className="w-full"
          />
        </div>

        <Button
          data-ocid="wallet.secondary_button"
          size="sm"
          variant="ghost"
          onClick={runSim}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground bg-card/80 border border-border"
          title="Reset layout"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-popover border border-border rounded-md px-3 py-2 text-xs shadow-lg"
          style={{
            left: tooltip.screenX + 14,
            top: tooltip.screenY - 14,
          }}
        >
          <div className="font-mono text-foreground mb-1 max-w-[220px] break-all">
            {tooltip.node.id}
          </div>
          <div className="text-muted-foreground">
            Transactions:{" "}
            <span className="text-foreground">{tooltip.node.txCount}</span>
          </div>
          {!tooltip.node.isCenter && (
            <div className="text-neon-blue mt-0.5">Click to explore →</div>
          )}
        </div>
      )}
    </div>
  );
}
