import { addAfterEffect, addTail, invalidate } from "@react-three/fiber";
import * as THREE from "three";

import { PerfSampler, type SampleChart, type SampleLog } from "./sampler";
import { createBackend, type AnyRenderer } from "./backends/detect";
import type { PerfBackend } from "./backends/types";
import { instanceFor, setRunning } from "./store";
import type { PerfProps } from "./types";

const updateMatrixWorldTemp = THREE.Object3D.prototype.updateMatrixWorld;
const updateWorldMatrixTemp = THREE.Object3D.prototype.updateWorldMatrix;
const updateMatrixTemp = THREE.Object3D.prototype.updateMatrix;

const maxGl = ["calls", "triangles", "points", "lines"] as const;

/**
 * Frames rendered after deepAnalyze is enabled, so frameloop="demand" scenes still
 * get populated: WebGL needs 2 (the first scan only injects `muiPerf` and forces a
 * recompile), plus slack for async WebGPU pipelines / GPU timestamps.
 */
const ANALYSIS_SETTLE_FRAMES = 4;

/**
 * Requests a frame for frameloop="demand". Deferred: an `invalidate()` issued
 * inside a global after-effect is lost — R3F has already decided to stop the loop.
 */
const requestFrame = () => queueMicrotask(() => invalidate());
const maxLog = ["gpu", "cpu", "mem", "fps"] as const;

export const matriceWorldCount = { value: 0 };
export const matriceCount = { value: 0 };
/** Cores currently counting matrix updates. */
let matrixCores = 0;

/** Fixed at core creation — they size buffers and throttles. */
type CoreOptions = {
  logsPerSecond: number;
  chartLength: number;
  chartHz: number;
};

/**
 * Runtime toggles. ON if ANY mounted instance enables them, so e.g.
 * <PerfHeadless /> (reading data) + <PerfMonitor deepAnalyze /> (debug UI) works.
 */
type LiveFlags = { deepAnalyze: boolean; matrixUpdate: boolean };

/** Applies defaults so `undefined` and the default value compare equal. */
const normalize = (options: PerfProps): CoreOptions => ({
  logsPerSecond: options.logsPerSecond || 10,
  chartLength: options.chart?.length ?? 120,
  chartHz: options.chart?.hz ?? 60,
});

/**
 * Perf measurement cores — one per renderer (canvas), ref-counted and
 * React-agnostic.
 *
 * The first `acquirePerf()` for a renderer picks its backend (WebGLRenderer /
 * WebGPURenderer) and starts measuring; later calls for the same renderer
 * register as extra holders. Release removes the holder and disposes at 0, so
 * <PerfHeadless /> and <PerfMonitor /> mounted in one canvas share ONE core.
 */
type Holder = LiveFlags & { id?: string };
type Core = ReturnType<typeof createCore> & {
  options: CoreOptions;
  holders: Set<Holder>;
};
const cores = new Map<AnyRenderer, Core>();

function mergedFlags(holders: Set<Holder>): LiveFlags {
  const flags: LiveFlags = { deepAnalyze: false, matrixUpdate: false };
  for (const holder of holders) {
    flags.deepAnalyze ||= holder.deepAnalyze;
    flags.matrixUpdate ||= holder.matrixUpdate;
  }
  return flags;
}

/** Tells the store which canvases are measured, and under which ids. */
function publishRunning() {
  const ids = new Map<string, AnyRenderer>();
  for (const [gl, core] of cores) {
    for (const holder of core.holders) {
      if (holder.id !== undefined) ids.set(holder.id, gl);
    }
  }
  setRunning([...cores.keys()], ids);
}

// R3F's global effects wrap ALL roots in a tick, so each canvas is timed from
// its own first useFrame (beginRootFrame) until the next measured canvas starts
// or the tick ends.
let rendering: Core | null = null;
let unhookLoop: (() => void) | null = null;

function endRootFrame() {
  rendering?.frameEnd();
  rendering = null;
}

/** Call first thing in a root's frame (useFrame at the lowest priority). */
export function beginRootFrame(gl: AnyRenderer) {
  const core = cores.get(gl);
  if (!core || core === rendering) return;
  endRootFrame();
  rendering = core;
  core.frameStart();
}

function hookLoop() {
  const unsubAfter = addAfterEffect(endRootFrame);
  // tail: when r3f stops rendering
  const unsubTail = addTail(() => {
    cores.forEach((core) => core.pause());
    return false;
  });
  unhookLoop = () => {
    unsubAfter();
    unsubTail();
  };
}

export function acquirePerf(
  gl: AnyRenderer,
  scene: THREE.Scene,
  options: PerfProps = {},
): () => void {
  const fixed = normalize(options);
  const holder: Holder = {
    deepAnalyze: !!options.deepAnalyze,
    matrixUpdate: !!options.matrixUpdate,
    id: options.id,
  };

  let core = cores.get(gl);
  if (!core) {
    core = {
      options: fixed,
      holders: new Set(),
      ...createCore(gl, scene, fixed),
    };
    cores.set(gl, core);
    if (cores.size === 1) hookLoop();
  } else if (
    core.options.logsPerSecond !== fixed.logsPerSecond ||
    core.options.chartLength !== fixed.chartLength ||
    core.options.chartHz !== fixed.chartHz
  ) {
    console.warn(
      "[r3f-monitor] acquirePerf: core is already running with a different logsPerSecond / chart — keeping the first instance's values.",
    );
  }
  const owner = core;
  owner.holders.add(holder);
  owner.setFlags(mergedFlags(owner.holders));
  publishRunning();

  let released = false;
  return () => {
    if (released) return;
    released = true;
    owner.holders.delete(holder);

    if (owner.holders.size === 0) {
      if (rendering === owner) rendering = null;
      owner.dispose();
      cores.delete(gl);
      if (cores.size === 0) unhookLoop?.();
    } else {
      owner.setFlags(mergedFlags(owner.holders));
    }
    publishRunning();
  };
}

/** Initializes the measurement core. */
function createCore(
  gl: AnyRenderer,
  scene: THREE.Scene,
  { logsPerSecond, chartLength, chartHz }: CoreOptions,
) {
  const { store, events } = instanceFor(gl);
  const { getState: getPerf, setState: setPerf } = store;
  setPerf({ gl, scene });

  const backend: PerfBackend = createBackend(gl, scene);
  backend.start();

  const memoryUpdateRate = 1000;
  let lastMemoryUpdate = 0;
  let disposed = false;

  // Live flags, driven by setFlags() below.
  let deepAnalyze = false;
  let matrixPatched = false;

  const passesUpdateRate = 500;
  let lastPassesUpdate = 0;
  let analysisFailed = false;
  let settleFrames = 0;

  const sampler = new PerfSampler({
    chartLen: chartLength,
    chartHz,
    logsPerSecond,

    chartLogger: (chart: SampleChart) => {
      setPerf({ chart });
    },

    paramLogger: (logger: SampleLog) => {
      const log = {
        maxMemory: logger.maxMemory,
        gpu: logger.gpu,
        gpuCompute: logger.gpuCompute,
        cpu: logger.cpu,
        mem: logger.mem,
        fps: logger.fps,
        rawFps: logger.rawFps,
        totalTime: logger.duration,
        frameCount: logger.frameCount,
      };

      setPerf({ log });

      const glStats = backend.readFrameStats();
      const { accumulated }: any = getPerf();

      accumulated.totalFrames++;
      accumulated.gl.calls += glStats.calls;
      accumulated.gl.triangles += glStats.triangles;
      accumulated.gl.points += glStats.points;
      accumulated.gl.lines += glStats.lines;

      accumulated.log.gpu += logger.gpu;
      accumulated.log.gpuCompute += logger.gpuCompute;
      accumulated.log.cpu += logger.cpu;
      accumulated.log.mem += logger.mem;
      accumulated.log.fps += logger.fps;

      for (let i = 0; i < maxGl.length; i++) {
        const key = maxGl[i];
        const value = glStats[key];
        if (value > accumulated.max.gl[key]) accumulated.max.gl[key] = value;
      }

      for (let i = 0; i < maxLog.length; i++) {
        const key = maxLog[i];
        const value = logger[key];
        if (value > accumulated.max.log[key]) accumulated.max.log[key] = value;
      }

      setPerf({ accumulated, glStats });

      events.emit("log", [
        log,
        { ...glStats, matrices: matriceCount.value + matriceWorldCount.value },
      ]);
    },
  });

  // Vendor/renderer info is async on WebGPU (adapter query); showing it a tick
  // late is fine and keeps acquirePerf synchronous for useEffect cleanup.
  setPerf({ startTime: window.performance.now() });
  backend
    .readInfos()
    .then((infos) => {
      if (!disposed) setPerf({ infos });
    })
    .catch(() => {});

  // optional: matrix update counting (patches THREE prototypes while on)
  const setMatrixUpdate = (on: boolean) => {
    if (on === matrixPatched) return;
    matrixPatched = on;

    // The prototypes are shared: patch for the first core, restore after the
    // last.
    matrixCores += on ? 1 : -1;
    if (matrixCores !== (on ? 1 : 0)) return;

    if (!on) {
      THREE.Object3D.prototype.updateMatrixWorld = updateMatrixWorldTemp;
      THREE.Object3D.prototype.updateWorldMatrix = updateWorldMatrixTemp;
      THREE.Object3D.prototype.updateMatrix = updateMatrixTemp;
      return;
    }

    THREE.Object3D.prototype.updateMatrixWorld = function (
      ...args: Parameters<typeof updateMatrixWorldTemp>
    ) {
      if (this.matrixWorldNeedsUpdate || args[0]) matriceWorldCount.value++;
      return updateMatrixWorldTemp.apply(this, args);
    };

    THREE.Object3D.prototype.updateWorldMatrix = function (
      ...args: Parameters<typeof updateWorldMatrixTemp>
    ) {
      matriceWorldCount.value++;
      return updateWorldMatrixTemp.apply(this, args);
    };

    THREE.Object3D.prototype.updateMatrix = function (
      ...args: Parameters<typeof updateMatrixTemp>
    ) {
      matriceCount.value++;
      return updateMatrixTemp.apply(this, args);
    };
  };

  const setFlags = (flags: LiveFlags) => {
    setMatrixUpdate(flags.matrixUpdate);

    if (flags.deepAnalyze === deepAnalyze) return;
    deepAnalyze = flags.deepAnalyze;
    analysisFailed = false; // re-enabling retries after an earlier error

    if (deepAnalyze) {
      settleFrames = ANALYSIS_SETTLE_FRAMES;
      requestFrame();
    } else {
      settleFrames = 0;
      backend.stopAnalysis();
      setPerf({ passes: [] });
    }
  };

  // PRE frame: reset stats + start CPU/GPU timing
  const frameStart = () => {
    sampler.paused = false;
    if (getPerf().paused) setPerf({ paused: false });

    sampler.begin();
    backend.beginFrame();

    matriceWorldCount.value = 0;
    matriceCount.value = 0;
  };

  // AFTER frame: stop timing + commit frame + deepAnalyze
  const frameEnd = () => {
    backend.endFrame();
    sampler.end();

    if (!sampler.paused) {
      const gpu = backend.readGpuTiming();
      sampler.nextFrame(window.performance.now(), gpu.render, gpu.compute);
    }

    const now = window.performance.now();

    if (now - lastMemoryUpdate > memoryUpdateRate) {
      lastMemoryUpdate = now;

      const memory = backend.readMemory();

      setPerf({
        estimatedMemory: {
          vram: memory.vram,
          tex: memory.tex,
          geo: memory.geo,
          ram: sampler.currentMem, // MB
          source: memory.source,
        },
      });
    }

    if (!deepAnalyze || analysisFailed || !backend.supportsProgramAnalysis) {
      return;
    }

    // Optional feature: an error here must never break measuring or the R3F loop.
    try {
      const programs = backend.analyzePrograms();
      if (programs) {
        setPerf({
          programs,
          triggerProgramsUpdate: getPerf().triggerProgramsUpdate + 1,
        });
      }

      // Skip the throttle while settling: in demand mode these may be the last frames.
      if (settleFrames > 0 || now - lastPassesUpdate > passesUpdateRate) {
        lastPassesUpdate = now;
        const passes = backend.readPasses();
        if (passes.length > 0 || getPerf().passes.length > 0) {
          setPerf({ passes });
        }
      }
    } catch (err) {
      analysisFailed = true;
      settleFrames = 0;
      console.warn(
        "[r3f-monitor] deepAnalyze disabled after an error; other metrics keep running.",
        err,
      );
    }

    if (settleFrames > 0) {
      settleFrames--;
      requestFrame();
    }
  };

  const pause = () => {
    sampler.paused = true;
    matriceCount.value = 0;
    matriceWorldCount.value = 0;

    // `log` keeps its last values: with isolated demand frames the tail runs
    // right after every frame, so resetting it here would hide every sample.
    setPerf({ paused: true });
  };

  const dispose = () => {
    disposed = true;

    backend.dispose();
    sampler.dispose();
    setMatrixUpdate(false);
  };

  return { setFlags, dispose, frameStart, frameEnd, pause };
}
