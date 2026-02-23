import React, { useEffect, useMemo, useRef, useState } from "react";
import { getPerf, usePerf } from "../store";

type Theme = { fg: string; bg: string };
const THEMES: Record<"fps" | "cpu" | "gpu", Theme> = {
  fps: { fg: "#00ffff", bg: "#000022" },
  cpu: { fg: "#00ff00", bg: "#002200" },
  gpu: { fg: "#ff0080", bg: "#220011" },
};

export type PanelKey = "fps" | "cpu" | "gpu";

export type PanelCfg = {
  key: PanelKey;
  label: string;
  maxVal: number;
};

const DEFAULT_PANELS: PanelCfg[] = [
  { key: "fps", label: "FPS", maxVal: 120 },
  { key: "cpu", label: "CPU", maxVal: 40 },
  { key: "gpu", label: "GPU", maxVal: 40 },
];

const PANEL_H = 48;
const TEXT_H = 15;
const GRAPH_X = 2;
const GRAPH_Y = TEXT_H;
const GRAPH_H = PANEL_H - GRAPH_Y - 2;
const GAP = 6;

const UPDATE_FPS = 15;
const INTERVAL = 1000 / UPDATE_FPS;

export function ChartStats({
  show = true,
  opacity = 1,
  className,
  style,
  panels = DEFAULT_PANELS,
  gap = GAP,
  showHeaderText = true,
  hasChange = false,
}: {
  show?: boolean;
  opacity?: number;
  className?: string;
  style?: React.CSSProperties;
  panels?: PanelCfg[];
  gap?: number;
  showHeaderText?: boolean;
  hasChange?: boolean;
}) {
  const paused = usePerf((s) => s.paused);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(300);

  const [activeIndex, setActiveIndex] = useState(0);

  const dpr = useMemo(
    () => Math.max(1, Math.round(window.devicePixelRatio || 1)),
    [],
  );

  const activePanels = useMemo(
    () => (hasChange ? [panels[activeIndex]] : panels),
    [hasChange, panels, activeIndex],
  );

  const count = Math.max(1, activePanels.length);
  const totalGap = (count - 1) * gap;
  const panelW = Math.max(0, (containerWidth - totalGap) / count);
  const dynamicGraphW = Math.max(0, panelW - GRAPH_X);

  const minMaxRef = useRef<Record<string, { min: number; max: number }>>({});

  useEffect(() => {
    if (!wrapperRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;

    c.width = containerWidth * dpr;
    c.height = PANEL_H * dpr;
    c.style.width = "100%";
    c.style.height = `${PANEL_H}px`;

    const ctx = c.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.font = "bold 9px Roboto Mono, monospace";
    ctx.textBaseline = "top";

    ctx.clearRect(0, 0, containerWidth, PANEL_H);

    const perf = getPerf();
    const circ = perf.chart.circularId;

    for (let p = 0; p < count; p++) {
      const { key, maxVal } = activePanels[p];
      const ox = p * (panelW + gap);
      const { fg, bg } = THEMES[key];

      // 1. Vẽ nền
      ctx.fillStyle = bg;
      ctx.globalAlpha = opacity;
      ctx.fillRect(ox, 0, panelW, PANEL_H);
      ctx.globalAlpha = 1;

      // 2. BACKFILL DỮ LIỆU CŨ ĐỂ KHÔNG BỊ CHẠY LẠI TỪ ĐẦU
      const series = perf.chart.data[key];
      let min = Infinity;
      let max = 0;

      if (series && series.length > 0) {
        const len = series.length;
        ctx.fillStyle = fg;

        for (let i = 0; i < dynamicGraphW; i++) {
          const idx = (circ - 1 - i + len) % len;
          const v = series[idx];
          if (v !== undefined) {
            min = Math.min(min, v);
            max = Math.max(max, v);
            const ratio = Math.min(v, maxVal) / maxVal;
            const barH = Math.round(ratio * GRAPH_H);
            if (barH > 0) {
              const x = ox + GRAPH_X + dynamicGraphW - 1 - i;
              ctx.fillRect(x, GRAPH_Y + GRAPH_H - barH, 1, barH);
            }
          }
        }
      }
      minMaxRef.current[key] = { min, max };
    }
  }, [
    dpr,
    containerWidth,
    panelW,
    opacity,
    activePanels,
    count,
    gap,
    dynamicGraphW,
  ]);

  useEffect(() => {
    if (!show) return;
    const c = canvasRef.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;

    let raf = 0;
    let lastTime = 0;

    function drawFrame(timestamp: number) {
      raf = requestAnimationFrame(drawFrame);
      if (paused) return;

      const delta = timestamp - lastTime;
      if (delta < INTERVAL) return;
      lastTime = timestamp - (delta % INTERVAL);

      const perf = getPerf();
      const circ = perf.chart.circularId;

      for (let p = 0; p < count; p++) {
        const { key, label, maxVal } = activePanels[p];
        const ox = p * (panelW + gap);
        const { fg, bg } = THEMES[key];

        const series = perf.chart.data[key];
        const len = series?.length || 0;

        let v = 0;
        if (len > 0) {
          const idx = (circ - 1 + len) % len;
          v = series[idx] ?? 0;
        }

        const mm = minMaxRef.current[key] || { min: Infinity, max: 0 };
        mm.min = Math.min(mm.min, v);
        mm.max = Math.max(mm.max, v);

        if (!ctx) return;

        if (showHeaderText) {
          ctx.fillStyle = bg;
          ctx.globalAlpha = 1;
          ctx.fillRect(ox, 0, panelW, TEXT_H);

          ctx.fillStyle = fg;
          const minTxt = mm.min === Infinity ? 0 : mm.min;
          const txt = `${label} (${Math.round(minTxt)}-${Math.round(mm.max)})`;
          ctx.fillText(txt, ox + 5, 3);
        }

        if (dynamicGraphW > 1) {
          if (!c) return;
          ctx.drawImage(
            c,
            (ox + GRAPH_X + 1) * dpr,
            GRAPH_Y * dpr,
            (dynamicGraphW - 1) * dpr,
            GRAPH_H * dpr,
            ox + GRAPH_X,
            GRAPH_Y,
            dynamicGraphW - 1,
            GRAPH_H,
          );
        }

        const rightEdgeX = ox + GRAPH_X + dynamicGraphW - 1;
        ctx.fillStyle = bg;
        ctx.globalAlpha = 1;
        ctx.fillRect(rightEdgeX, GRAPH_Y, 1, GRAPH_H);

        ctx.fillStyle = fg;
        const ratio = Math.min(v, maxVal) / maxVal;
        const barH = Math.round(ratio * GRAPH_H);
        if (barH > 0)
          ctx.fillRect(rightEdgeX, GRAPH_Y + GRAPH_H - barH, 1, barH);
      }
    }

    raf = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(raf);
  }, [
    paused,
    show,
    dpr,
    panelW,
    dynamicGraphW,
    activePanels,
    count,
    gap,
    showHeaderText,
  ]);

  if (!show) return null;

  return (
    <div
      ref={wrapperRef}
      className={className}
      onClick={() => {
        if (hasChange && panels.length > 1) {
          setActiveIndex((prev) => (prev + 1) % panels.length);
        }
      }}
      style={{
        width: "100%",
        marginTop: gap,
        position: "relative",
        cursor: hasChange ? "pointer" : "default",
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          pointerEvents: "none",
          width: "100%",
          height: `${PANEL_H}px`,
        }}
      />

      {hasChange && (
        <div
          style={{
            position: "absolute",
            top: -5,
            right: 6,
            fontSize: 13,
            opacity: 0.8,
            pointerEvents: "none",
            color: "#fff",
          }}
        >
          ⇄
        </div>
      )}
    </div>
  );
}
