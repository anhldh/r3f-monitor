import * as React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { addEffect } from "@react-three/fiber";
import { useEvent } from "../events/react";
import { detectRefreshRate } from "./detectRefreshRate";
import {
  AdaptiveEngine,
  type AdaptiveCallbacks,
  type AdaptiveEngineOptions,
} from "./AdaptiveEngine";

export type PerfAdaptiveProps = AdaptiveEngineOptions & {
  /** Children can use the usePerfAdaptive hook */
  children?: React.ReactNode;
};

type LogSample = { fps: number; rawFps?: number; gpu: number; cpu: number };

const context = /* @__PURE__ */ createContext<AdaptiveEngine>(null!);

/**
 * Adaptive quality driven by r3f-monitor measurements.
 *
 * Needs <PerfHeadless /> (directly or via <PerfMonitor />) mounted inside
 * <Canvas> — same as usePerfData. Each log tick (PerfHeadless `logsPerSecond`)
 * feeds one {fps, gpu, cpu} sample into the engine.
 *
 * drei <PerformanceMonitor>-compatible: use onIncline/onDecline/onChange or read
 * `engine.factor` (0-1) to tune dpr, shadows, effects... In callbacks, compare
 * `engine.gpu` with `engine.cpu`: GPU-bound (lower dpr/effects) vs CPU-bound
 * (reduce draw calls).
 */
export function PerfAdaptive({
  children,
  onIncline,
  onDecline,
  onChange,
  onFallback,
  ...options
}: PerfAdaptiveProps) {
  const [engine] = useState(() => new AdaptiveEngine(options));

  // Seed refresh rate early from rAF timing — otherwise a scene that's heavy from
  // the start never shows high FPS and the engine learns the wrong refresh rate.
  // Max-FPS learning still runs alongside (only increases).
  useEffect(() => {
    detectRefreshRate().then((hz) => engine.seedRefreshrate(hz));
  }, [engine]);

  // Register callbacks via subscribe (always uses the latest props)
  const callbacksRef = useRef<AdaptiveCallbacks>({
    onIncline,
    onDecline,
    onChange,
    onFallback,
  });
  useLayoutEffect(() => {
    callbacksRef.current.onIncline = onIncline;
    callbacksRef.current.onDecline = onDecline;
    callbacksRef.current.onChange = onChange;
    callbacksRef.current.onFallback = onFallback;
  }, [onIncline, onDecline, onChange, onFallback]);
  useLayoutEffect(() => engine.subscribe(callbacksRef.current), [engine]);

  // Sole data source: the "log" event emitted by PerfHeadless.
  // While paused (hidden tab / idle loop) paramLogger stops -> no bogus samples.
  // Prefer rawFps (1s window) for stable adaptation; the UI uses per-frame fps.
  //
  // "log" fires from addAfterEffect (AFTER the frame is drawn) — running callbacks
  // there would let setDpr resize (clear) the buffer post-render -> 1-frame flicker.
  // So samples are only queued here and flushed in addEffect (BEFORE render), so
  // user changes land in the same frame — same as drei.
  const queue = useRef<LogSample[]>([]);
  useEvent("log", ([log]: [LogSample, unknown]) => {
    queue.current.push(log);
  });
  useEffect(
    () =>
      addEffect(() => {
        const samples = queue.current;
        if (samples.length === 0) return;
        queue.current = [];
        for (const log of samples) {
          engine.addSample(log.rawFps ?? log.fps, log.gpu, log.cpu);
        }
      }),
    [engine],
  );

  return <context.Provider value={engine}>{children}</context.Provider>;
}

/**
 * Hook for <PerfAdaptive> children — equivalent to drei's usePerformanceMonitor.
 */
export function usePerfAdaptive({
  onIncline,
  onDecline,
  onChange,
  onFallback,
}: AdaptiveCallbacks) {
  const engine = useContext(context);
  const ref = useRef<AdaptiveCallbacks>({
    onIncline,
    onDecline,
    onChange,
    onFallback,
  });

  useLayoutEffect(() => {
    ref.current.onIncline = onIncline;
    ref.current.onDecline = onDecline;
    ref.current.onChange = onChange;
    ref.current.onFallback = onFallback;
  }, [onIncline, onDecline, onChange, onFallback]);

  useLayoutEffect(() => engine.subscribe(ref.current), [engine]);
}
