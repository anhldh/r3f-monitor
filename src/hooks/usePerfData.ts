import { usePerf } from "../store";
import type {
  BackendApi,
  BackendKind,
  MemorySource,
} from "../backends/types";

/**
 * Throttled perf metrics, ready for UI.
 * - fps/cpu/gpu/mem/vram: live values, updated at `logsPerSecond` (~10/s).
 * - gl: render stats of the latest frame.
 * - infos: renderer info (static for the session).
 */
export type PerfData = {
  fps: number;
  cpu: number;
  gpu: number;
  /** Compute pass time in ms. WebGPU only — always 0 on WebGL. */
  gpuCompute: number;
  mem: number;
  vram: number;
  /** `measured` (WebGPU, real bytes) or `estimated` (WebGL, from scene traversal). */
  vramSource: MemorySource;
  gl: {
    calls: number;
    triangles: number;
    points: number;
    lines: number;
    geometries: number;
    textures: number;
    programs: number;
    /** Compute dispatches this frame. Always 0 on WebGL. */
    computeCalls: number;
  };
  infos: {
    version: string;
    renderer: string;
    vendor: string;
    /** Renderer class: `webgl` = WebGLRenderer, `webgpu` = WebGPURenderer. */
    backend: BackendKind;
    /** Underlying GPU API — WebGPURenderer may be running its `webgl2` backend. */
    api: BackendApi;
  };
};

export type PerfDataOptions = {
  /**
   * Which canvas to read, as named by the `id` prop of its <PerfHeadless /> or
   * <PerfMonitor />. Defaults to the surrounding <Canvas>, or the first
   * measured canvas when called outside one.
   */
  id?: string;
};

/** Flattens raw store state into PerfData. */
const select = (s: import("../store").State): PerfData => ({
  fps: s.log?.fps ?? 0,
  cpu: s.log?.cpu ?? 0,
  gpu: s.log?.gpu ?? 0,
  gpuCompute: s.log?.gpuCompute ?? 0,
  mem: s.log?.mem ?? 0,
  vram: s.estimatedMemory.vram,
  vramSource: s.estimatedMemory.source,
  // Read the normalized snapshot instead of `s.gl.info`: WebGLRenderer and
  // WebGPURenderer expose different `info` shapes (e.g. per-frame draw calls are
  // `render.calls` on one and `render.drawCalls` on the other).
  gl: s.glStats,
  infos: s.infos,
});

/**
 * Hook for reading perf metrics to build your own UI ("bring your own UI").
 *
 * Requires <PerfHeadless /> inside <Canvas>. Updates at PerfHeadless
 * `logsPerSecond`, not every frame.
 *
 * @example
 * // Everything
 * const { fps, gpu, gl, infos } = usePerfData();
 *
 * @example
 * // Single field -> re-renders only when it changes
 * const fps = usePerfData((d) => d.fps);
 *
 * @example
 * // Several canvases: name one with <PerfHeadless id="left" />, then
 * const { fps, gl } = usePerfData({ id: "left" });
 * const fps = usePerfData((d) => d.fps, { id: "left" });
 */
export function usePerfData(options?: PerfDataOptions): PerfData;
export function usePerfData<T>(
  selector: (data: PerfData) => T,
  options?: PerfDataOptions,
): T;
export function usePerfData<T>(
  selectorOrOptions?: ((data: PerfData) => T) | PerfDataOptions,
  options?: PerfDataOptions,
) {
  const hasSelector = typeof selectorOrOptions === "function";
  const selector = hasSelector ? selectorOrOptions : undefined;
  const id = (hasSelector ? options : selectorOrOptions)?.id;

  return usePerf((s) => {
    const data = select(s);
    return selector ? selector(data) : data;
  }, id);
}
