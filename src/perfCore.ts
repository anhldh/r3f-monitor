import {
  addAfterEffect,
  addEffect,
  addTail,
  invalidate,
} from "@react-three/fiber";
import * as THREE from "three";

import { PerfSampler, type SampleChart, type SampleLog } from "./sampler";
import { createBackend, type AnyRenderer } from "./backends/detect";
import type { PerfBackend } from "./backends/types";
import { getPerf, setPerf } from "./store";
import type { PerfProps } from "./types";
import { emitEvent } from "./events/vanilla";

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
 * Perf measurement core — ref-counted singleton, React-agnostic.
 *
 * The first `acquirePerf()` picks a backend for the active renderer
 * (WebGLRenderer / WebGPURenderer) and hooks into the render loop; later calls
 * register as extra holders. Release removes the holder and disposes at 0,
 * so <PerfHeadless /> and <PerfMonitor /> mounted together share ONE core.
 */
const holders = new Set<LiveFlags>();
let current: {
  gl: AnyRenderer;
  options: CoreOptions;
  setFlags: (flags: LiveFlags) => void;
  dispose: () => void;
} | null = null;

function mergedFlags(): LiveFlags {
  const flags: LiveFlags = { deepAnalyze: false, matrixUpdate: false };
  for (const holder of holders) {
    flags.deepAnalyze ||= holder.deepAnalyze;
    flags.matrixUpdate ||= holder.matrixUpdate;
  }
  return flags;
}

export function acquirePerf(
  gl: AnyRenderer,
  scene: THREE.Scene,
  options: PerfProps = {},
): () => void {
  const fixed = normalize(options);
  const holder: LiveFlags = {
    deepAnalyze: !!options.deepAnalyze,
    matrixUpdate: !!options.matrixUpdate,
  };
  holders.add(holder);

  if (!current) {
    current = { gl, options: fixed, ...createCore(gl, scene, fixed) };
  } else if (current.gl !== gl) {
    console.warn(
      "[r3f-monitor] acquirePerf: core is already bound to another renderer — multi-canvas is not supported, reusing the existing core.",
    );
  } else if (
    current.options.logsPerSecond !== fixed.logsPerSecond ||
    current.options.chartLength !== fixed.chartLength ||
    current.options.chartHz !== fixed.chartHz
  ) {
    console.warn(
      "[r3f-monitor] acquirePerf: core is already running with a different logsPerSecond / chart — keeping the first instance's values.",
    );
  }
  current.setFlags(mergedFlags());

  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders.delete(holder);
    if (!current) return;

    if (holders.size === 0) {
      current.dispose();
      current = null;
    } else {
      current.setFlags(mergedFlags());
    }
  };
}

/** Initializes the measurement core. */
function createCore(
  gl: AnyRenderer,
  scene: THREE.Scene,
  { logsPerSecond, chartLength, chartHz }: CoreOptions,
): { setFlags: (flags: LiveFlags) => void; dispose: () => void } {
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

      emitEvent("log", [
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
  const unsubEffect = addEffect(() => {
    if (sampler.paused) {
      sampler.paused = false;
      sampler.resume();
    }
    if (getPerf().paused) setPerf({ paused: false });

    sampler.begin();
    backend.beginFrame();

    matriceWorldCount.value = 0;
    matriceCount.value = 0;
  });

  // AFTER frame: stop timing + commit frame + deepAnalyze
  const unsubAfter = addAfterEffect((timestamp) => {
    backend.endFrame();
    sampler.end();

    if (!sampler.paused) {
      const gpu = backend.readGpuTiming();
      sampler.nextFrame(timestamp, gpu.render, gpu.compute);
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
  });

  // tail: when r3f stops rendering
  const unsubTail = addTail(() => {
    sampler.paused = true;
    matriceCount.value = 0;
    matriceWorldCount.value = 0;

    setPerf({
      paused: true,
      log: {
        maxMemory: 0,
        gpu: 0,
        gpuCompute: 0,
        mem: 0,
        cpu: 0,
        fps: 0,
        totalTime: 0,
        frameCount: 0,
      },
    });
    return false;
  });

  const dispose = () => {
    disposed = true;

    backend.dispose();
    sampler.dispose();
    setMatrixUpdate(false);

    unsubEffect();
    unsubAfter();
    unsubTail();
  };

  return { setFlags, dispose };
}
