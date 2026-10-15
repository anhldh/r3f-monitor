import type * as THREE from "three";

import { countGeoDrawCalls } from "../helpers/countGeoDrawCalls";
import type { ProgramsPerf, ProgramsPerfs } from "../store";
import type { WebGpuRendererLike } from "./detect";
import type {
  FrameStats,
  GpuTiming,
  MemoryStats,
  PassStats,
  PerfBackend,
  RendererInfos,
} from "./types";

/** three's `TimestampQuery.RENDER` / `.COMPUTE` are just these strings. */
const RENDER = "render" as const;
const COMPUTE = "compute" as const;

/** Frames kept while waiting for async GPU timestamps to resolve. */
const PASS_HISTORY = 8;

type PassRecord = PassStats & { uid: string; start: number };

type InspectorHook = "beginRender" | "finishRender" | "beginCompute" | "finishCompute";

function passName(scene: any, target: unknown): string {
  const base = scene?.name || (scene?.isQuadMesh ? "QuadMesh" : "Scene");
  return target ? `${base} (RT)` : base;
}

const toStats = ({ type, name, cpu, gpu }: PassRecord): PassStats => ({
  type,
  name,
  cpu,
  gpu,
});

type GpuAdapterInfo = {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
};

/**
 * Adapter for `WebGPURenderer` — covers BOTH its WebGPU and WebGL2 backends,
 * since three exposes one API for both (`WebGLTimestampQueryPool` uses
 * `EXT_disjoint_timer_query_webgl2` underneath but surfaces the same
 * `resolveTimestampsAsync()` / `info.render.timestamp`).
 */
export class WebGpuPerfBackend implements PerfBackend {
  readonly kind = "webgpu" as const;

  /**
   * Node materials compile to WGSL pipelines with no program list to map back to
   * materials, so deepAnalyze groups scene meshes by material instead — works on
   * any three version. Per-pass timing additionally needs `renderer.inspector`
   * (three r181+) and is skipped silently when absent.
   */
  readonly supportsProgramAnalysis = true;

  private gl: WebGpuRendererLike;
  private scene: THREE.Scene;
  private timingOn = false;
  private lastSignature = "";
  private autoResetBefore = true;
  private trackTimestampBefore: boolean | undefined;

  // Per-pass timing — hooked lazily, only when deepAnalyze is on.
  private inspector: Record<string, any> | null = null;
  private unhookInspector: (() => void) | null = null;
  private currentFrame: PassRecord[] | null = null;
  private openPasses = new Map<string, PassRecord>();
  private passHistory: PassRecord[][] = [];

  constructor(gl: WebGpuRendererLike, scene: THREE.Scene) {
    this.gl = gl;
    this.scene = scene;
  }

  get gpuTimingAvailable() {
    return this.timingOn;
  }

  start() {
    this.autoResetBefore = this.gl.info.autoReset;
    this.gl.info.autoReset = false;

    // `trackTimestamp` defaults to false and is usually set in `new WebGPURenderer()`.
    // Enabling it after `init()` works because three requests ALL adapter-supported
    // features at device creation (`requiredFeatures: supportedFeatures`), not gated
    // by this flag — so `timestamp-query` is already available. Users don't need to
    // change renderer setup to get GPU timing.
    try {
      if (this.gl.hasFeature("timestamp-query")) {
        this.trackTimestampBefore = this.gl.backend.trackTimestamp;
        this.gl.backend.trackTimestamp = true;
        this.timingOn = true;
      }
    } catch {
      this.timingOn = false;
    }
  }

  async readInfos(): Promise<RendererInfos> {
    const isWebGpu = this.gl.backend.isWebGPUBackend === true;

    if (!isWebGpu) {
      // On the WebGL2 fallback there's a real WebGL context to query — use it rather
      // than returning "Unknown", since this is the default path without WebGPU.
      const ctx = this.gl.backend.gl;
      const debugInfo: any = ctx?.getExtension("WEBGL_debug_renderer_info");

      return {
        version: ctx
          ? ctx.getParameter(ctx.VERSION)
          : "WebGPURenderer (WebGL 2 backend)",
        renderer:
          (debugInfo &&
            ctx?.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) ||
          ctx?.getParameter(ctx.RENDERER) ||
          "Unknown renderer",
        vendor:
          (debugInfo && ctx?.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL)) ||
          "Unknown vendor",
        backend: "webgpu",
        api: "webgl2",
      };
    }

    // Renderer's `getContext()` returns `unknown`, no WEBGL_debug_renderer_info.
    // Adapter info is the only source for vendor/device.
    let info: GpuAdapterInfo = {};
    try {
      const adapter = await navigator.gpu?.requestAdapter();
      info = ((adapter as unknown as { info?: GpuAdapterInfo })?.info ??
        {}) as GpuAdapterInfo;
    } catch {
      /* keep the defaults below */
    }

    const renderer =
      info.description ||
      [info.vendor, info.architecture].filter(Boolean).join(" ") ||
      "Unknown renderer";

    return {
      version: "WebGPU",
      renderer,
      vendor: info.vendor || "Unknown vendor",
      backend: "webgpu",
      api: "webgpu",
    };
  }

  beginFrame() {
    this.gl.info.reset();

    if (this.inspector) {
      this.currentFrame = [];
      this.openPasses.clear();
    }
  }

  endFrame() {
    if (this.currentFrame) {
      if (this.currentFrame.length > 0) {
        this.passHistory.push(this.currentFrame);
        if (this.passHistory.length > PASS_HISTORY) this.passHistory.shift();
      }
      this.currentFrame = null;
    }

    if (!this.timingOn) return;

    // three does NOT auto-resolve: `info[type].timestamp` is only written inside
    // `resolveTimestampsAsync()`. Without calling it the query pool fills (2048) and warns.
    // Fire-and-forget — three guards overlapping calls via `pendingResolve`, so
    // results lag a few frames. Fine for a HUD.
    // Per-uid timestamps must be read right after a resolve: newer three clears
    // the pool's map on every resolve.
    const fill = this.inspector ? () => this.fillPassGpu() : undefined;
    void this.gl.resolveTimestampsAsync(RENDER).then(fill).catch(() => {});
    if (this.gl.info.compute.frameCalls > 0) {
      void this.gl.resolveTimestampsAsync(COMPUTE).then(fill).catch(() => {});
    }
  }

  readFrameStats(): FrameStats {
    const { render, compute, memory } = this.gl.info;
    return {
      // `render.calls` is cumulative since start; the per-FRAME count is `drawCalls`.
      calls: render.drawCalls,
      triangles: render.triangles,
      points: render.points,
      lines: render.lines,
      geometries: memory.geometries,
      textures: memory.textures,
      programs: memory.programs,
      computeCalls: compute.frameCalls,
    };
  }

  readGpuTiming(): GpuTiming {
    return {
      render: this.gl.info.render.timestamp,
      compute: this.gl.info.compute.timestamp,
    };
  }

  /** Real bytes tracked by three — not an estimate like the WebGL path. */
  readMemory(): MemoryStats {
    const memory = this.gl.info.memory;
    const geo = memory.attributesSize + memory.indexAttributesSize;

    return {
      vram: memory.total / 1024 / 1024,
      tex: memory.texturesSize / 1024 / 1024,
      geo: geo / 1024 / 1024,
      source: "measured",
    };
  }

  analyzePrograms(): ProgramsPerfs | null {
    this.hookInspector();

    // No define injection here (unlike WebGL), so gating on counts is safe.
    // Trade-off: misses a new mesh that reuses an existing material + geometry.
    const { programs: pipelines, geometries } = this.gl.info.memory;
    const signature = `${pipelines}:${geometries}`;
    if (signature === this.lastSignature) return null;
    this.lastSignature = signature;

    const programs: ProgramsPerfs = new Map();

    this.scene.traverse((object: any) => {
      if (!(object.isMesh || object.isPoints || object.isLine)) return;
      if (!object.material) return;

      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      for (const material of materials) {
        let entry = programs.get(material.uuid);
        if (!entry) {
          entry = {
            material,
            meshes: {},
            drawCounts: { total: 0, type: "Triangle", data: [] },
            expand: false,
            visible: true,
          } as ProgramsPerf;
          programs.set(material.uuid, entry);
        }
        (entry.meshes as Record<string, unknown>)[object.uuid] = object;
      }
    });

    countGeoDrawCalls(programs);
    return programs;
  }

  /** Latest frame whose passes all have GPU times; CPU-only when timing is off. */
  readPasses(): PassStats[] {
    for (let i = this.passHistory.length - 1; i >= 0; i--) {
      const frame = this.passHistory[i];
      if (!this.timingOn || frame.every((p) => p.gpu !== null)) {
        return frame.map(toStats);
      }
    }
    const last = this.passHistory[this.passHistory.length - 1];
    return last ? last.map(toStats) : [];
  }

  /**
   * Wraps the existing `renderer.inspector` instance instead of replacing it, so a
   * user-installed inspector (e.g. three's Inspector addon) keeps working.
   * Re-hooks if the user swaps the inspector later. No-op on three < r181.
   */
  private hookInspector() {
    const insp = this.gl.inspector;
    if (insp === this.inspector) return;

    this.unhookInspector?.();
    this.unhookInspector = null;
    this.inspector = null;
    this.passHistory = [];

    if (
      !insp ||
      typeof insp.beginRender !== "function" ||
      typeof insp.finishRender !== "function"
    ) {
      return;
    }

    const restores: (() => void)[] = [];
    const wrap = (key: InspectorHook, before: (...args: any[]) => void) => {
      const original = insp[key];
      if (typeof original !== "function") return;
      const own = Object.prototype.hasOwnProperty.call(insp, key);

      insp[key] = (...args: any[]) => {
        try {
          before(...args);
        } catch {
          /* never break three's render path */
        }
        return original.apply(insp, args);
      };

      restores.push(() => {
        if (own) insp[key] = original;
        else delete insp[key];
      });
    };

    wrap("beginRender", (uid, scene, _camera, target) =>
      this.openPass(uid, "render", passName(scene, target)),
    );
    wrap("finishRender", (uid) => this.closePass(uid));
    wrap("beginCompute", (uid, node) =>
      this.openPass(uid, "compute", node?.name || "Compute"),
    );
    wrap("finishCompute", (uid) => this.closePass(uid));

    this.inspector = insp;
    this.unhookInspector = () => restores.forEach((restore) => restore());
  }

  private openPass(uid: string, type: PassStats["type"], name: string) {
    if (!this.currentFrame) return; // rendered outside the R3F frame
    const pass: PassRecord = {
      uid,
      type,
      name,
      start: performance.now(),
      cpu: 0,
      gpu: null,
    };
    this.currentFrame.push(pass);
    this.openPasses.set(uid, pass);
  }

  private closePass(uid: string) {
    const pass = this.openPasses.get(uid);
    if (!pass) return;
    pass.cpu = performance.now() - pass.start;
    this.openPasses.delete(uid);
  }

  private fillPassGpu() {
    for (const frame of this.passHistory) {
      for (const pass of frame) {
        if (pass.gpu === null) pass.gpu = this.readPassGpu(pass.uid);
      }
    }
  }

  /** GPU ms for one pass, or null if not resolved. */
  private readPassGpu(uid: string): number | null {
    const backend = this.gl.backend;
    try {
      if (typeof backend.hasTimestampQuery === "function") {
        return backend.hasTimestampQuery(uid) && backend.getTimestamp
          ? backend.getTimestamp(uid)
          : null;
      }
      // r181–r183: no hasTimestampQuery, and getTimestamp() warns on unknown
      // uids — peek at the pool's map instead.
      const pool =
        backend.timestampQueryPool?.[uid.startsWith("c:") ? COMPUTE : RENDER];
      const value = pool?.timestamps?.get(uid);
      return typeof value === "number" ? value : null;
    } catch {
      return null;
    }
  }

  stopAnalysis() {
    this.unhookInspector?.();
    this.unhookInspector = null;
    this.inspector = null;
    this.currentFrame = null;
    this.openPasses.clear();
    this.passHistory = [];
    this.lastSignature = "";
  }

  dispose() {
    // Nobody resets `info` or resolves timestamp queries once the monitor is
    // gone: hand both back to three as they were.
    this.gl.info.autoReset = this.autoResetBefore;
    if (this.timingOn) {
      this.gl.backend.trackTimestamp = this.trackTimestampBefore;
    }

    this.timingOn = false;
    this.stopAnalysis();
  }
}
