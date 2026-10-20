// ── Default UI ───────────────────────────────────────────────
export { PerfMonitor } from "./components/PerfMonitor";

// ── Headless / Bring your own UI ─────────────────────────────
/**
 * Measures without rendering UI. Place inside <Canvas>.
 * Pair with <PerfAdaptive /> for FPS-driven adaptive quality.
 */
export { PerfHeadless } from "./components/PerfHeadless";

/**
 * Hook for reading metrics to build your own UI.
 * - `usePerfData()` -> everything { fps, cpu, gpu, mem, vram, gl, infos }.
 * - `usePerfData(d => d.fps)` -> a single field (re-renders only when it changes).
 * - Several canvases: `usePerfData({ id })`, `usePerfData(d => d.fps, { id })`.
 */
export {
  usePerfData,
  type PerfData,
  type PerfDataOptions,
} from "./hooks/usePerfData";

// ── Backend (WebGL / WebGPU) ─────────────────────────────────
/**
 * r3f-monitor detects the active renderer — WebGLRenderer or WebGPURenderer —
 * and picks the matching measurement path. No configuration needed.
 *
 * Note `backend` differs from `api`: three's WebGPURenderer falls back to its
 * WebGL2 backend when `navigator.gpu` is missing, so `backend: "webgpu"` can
 * come with `api: "webgl2"`.
 */
export type {
  BackendApi,
  BackendKind,
  FrameStats,
  MemorySource,
} from "./backends/types";

// ── Adaptive quality ─────────────────────────────────────────
/**
 * Adjusts `factor` (0-1) to lower/raise quality based on FPS.
 * Reads {fps, gpu, cpu} from PerfHeadless — needs <PerfHeadless /> inside
 * <Canvas> (like usePerfData). drei <PerformanceMonitor>-compatible API.
 */
export {
  PerfAdaptive,
  usePerfAdaptive,
  type PerfAdaptiveProps,
} from "./performance/PerfAdaptive";
export {
  AdaptiveEngine,
  type AdaptiveEngineOptions,
  type AdaptiveCallbacks,
} from "./performance/AdaptiveEngine";
export { detectRefreshRate } from "./performance/detectRefreshRate";

// ── GPU tier ─────────────────────────────────────────────────
/**
 * Detects GPU tier (0-3) via @pmndrs/detect-gpu to pick a starting quality
 * per device; PerfAdaptive fine-tunes at runtime.
 * Suspends — components using it must be inside <Suspense>.
 */
export {
  useGpuTier,
  useDetectGPU,
  GpuTier,
  type GpuTierProps,
} from "./performance/useGpuTier";
