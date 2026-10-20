import { createContext, useContext, useSyncExternalStore } from "react";
import { context as r3fContext } from "@react-three/fiber";
import EventEmitter from "eventemitter3";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStoreWithEqualityFn } from "zustand/traditional";
import { shallow } from "zustand/shallow";
import * as THREE from "three";

import type { AnyRenderer } from "./backends/detect";
import type {
  BackendApi,
  BackendKind,
  FrameStats,
  MemorySource,
  PassStats,
} from "./backends/types";

// Type memory
export type EstimatedMemory = {
  vram: number;
  tex: number;
  geo: number;
  ram: number;
  /**
   * `measured`: real byte tracking by the renderer (WebGPU).
   * `estimated`: derived by traversing the scene (WebGL).
   * Backends report different numbers for the same scene; the UI labels the source.
   */
  source: MemorySource;
};

type drawCount = {
  type: string;
  drawCount: number;
};
export type drawCounts = {
  total: number;
  type: string;
  data: drawCount[];
};

export type ProgramsPerf = {
  meshes?: {
    [index: string]: THREE.Mesh[];
  };
  material: THREE.Material;
  program?: WebGLProgram;
  visible: boolean;
  drawCounts: drawCounts;
  expand: boolean;
};

type Logger = {
  i: number;
  maxMemory: number;
  gpu: number;
  /** Compute pass time in ms. WebGPU only — always 0 on WebGL. */
  gpuCompute: number;
  mem: number;
  cpu: number;
  fps: number;
  duration: number;
  frameCount: number;
};

type GLLogger = {
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  counts: number;
};

/** Backend-normalized frame stats, updated at `logsPerSecond`. */
export type GlStats = FrameStats;

export type State = {
  getReport: () => any;
  log: any;
  paused: boolean;
  fpsLimit: number;
  startTime: number;
  triggerProgramsUpdate: number;
  customData: number;
  estimatedMemory: EstimatedMemory;
  // --------------------------
  accumulated: {
    totalFrames: number;
    /** Ticks with a measured fps (it is 0 before the first measurement). */
    fpsFrames: number;
    log: Logger;
    gl: GLLogger;
    max: {
      log: Logger;
      gl: GLLogger;
    };
  };
  chart: {
    data: {
      [index: string]: number[];
    };
    circularId: number;
  };
  infos: {
    version: string;
    renderer: string;
    vendor: string;
    backend: BackendKind;
    api: BackendApi;
  };
  glStats: GlStats;
  /**
   * Active renderer: WebGLRenderer OR WebGPURenderer. Read stats via `glStats`,
   * not `info` directly — the two renderers expose different `info` shapes.
   */
  gl: AnyRenderer | undefined;
  scene: THREE.Scene | undefined;
  /** Requests a frame on the measured canvas only (frameloop="demand"). */
  invalidate: () => void;
  programs: ProgramsPerfs;
  /** Per-pass timings (deepAnalyze on WebGPU, three r181+). */
  passes: PassStats[];
  objectWithMaterials: THREE.Mesh[] | null;
  tab: "infos" | "programs" | "data";
};

export type ProgramsPerfs = Map<string, ProgramsPerf>;

const createPerfStore = () => createStore<State>((_set, get): any => {
  function getReport() {
    const { accumulated, startTime, infos, estimatedMemory } = get();
    const maxMemory = get().log?.maxMemory;
    const { totalFrames, fpsFrames, log, gl, max } = accumulated;

    const glAverage = {
      calls: gl.calls / totalFrames,
      triangles: gl.triangles / totalFrames,
      points: gl.points / totalFrames,
      lines: gl.lines / totalFrames,
    };

    const logAverage = {
      gpu: log.gpu / totalFrames,
      cpu: log.cpu / totalFrames,
      mem: log.mem / totalFrames,
      fps: fpsFrames ? log.fps / fpsFrames : 0,
    };

    const sessionTime = (window.performance.now() - startTime) / 1000;

    return {
      sessionTime,
      infos,
      memory: estimatedMemory, // include memory in the report
      log: logAverage,
      gl: glAverage,
      max,
      maxMemory,
      totalFrames,
    };
  }

  return {
    log: null,
    paused: false,
    triggerProgramsUpdate: 0,
    startTime: 0,
    customData: 0,
    fpsLimit: 60,
    estimatedMemory: {
      vram: 0,
      tex: 0,
      geo: 0,
      ram: 0,
      source: "estimated" as MemorySource,
    },
    glStats: {
      calls: 0,
      triangles: 0,
      points: 0,
      lines: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      computeCalls: 0,
    },
    infos: {
      version: "",
      renderer: "",
      vendor: "",
      backend: "webgl" as BackendKind,
      api: "webgl2" as BackendApi,
    },
    // -------------------------------------
    accumulated: {
      totalFrames: 0,
      fpsFrames: 0,
      gl: {
        calls: 0,
        triangles: 0,
        points: 0,
        lines: 0,
        counts: 0,
      },
      log: {
        gpu: 0,
        gpuCompute: 0,
        cpu: 0,
        mem: 0,
        fps: 0,
      },
      max: {
        gl: {
          calls: 0,
          triangles: 0,
          points: 0,
          lines: 0,
          counts: 0,
        },
        log: {
          gpu: 0,
          gpuCompute: 0,
          cpu: 0,
          mem: 0,
          fps: 0,
        },
      },
    },
    chart: {
      data: {
        fps: [],
        cpu: [],
        gpu: [],
        mem: [],
      },
      circularId: 0,
    },
    gl: undefined,
    objectWithMaterials: null,
    passes: [],
    scene: undefined,
    invalidate: () => {},
    programs: new Map(),
    sceneLength: undefined,
    tab: "infos",
    getReport,
  };
});

/** One measured canvas: its own store and its own `log` events. */
export type PerfInstance = { store: StoreApi<State>; events: EventEmitter };

const createInstance = (): PerfInstance => ({
  store: createPerfStore(),
  events: new EventEmitter(),
});

// Kept per renderer, not per core, so UI state survives a core restart.
const instances = new WeakMap<AnyRenderer, PerfInstance>();

export function instanceFor(gl: AnyRenderer): PerfInstance {
  let instance = instances.get(gl);
  if (!instance) instances.set(gl, (instance = createInstance()));
  return instance;
}

/** What hooks read while no canvas is being measured. */
const EMPTY = createInstance();

// Renderers with a running core, in mount order, and the ids given to them.
let running: AnyRenderer[] = [];
let ids = new Map<string, AnyRenderer>();
const listeners = new Set<() => void>();

export function setRunning(
  nextRunning: AnyRenderer[],
  nextIds: Map<string, AnyRenderer>,
) {
  running = nextRunning;
  ids = nextIds;
  listeners.forEach((listener) => listener());
}

const subscribeRunning = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};

const resolve = (id?: string) => {
  const gl = id === undefined ? running[0] : ids.get(id);
  return gl ? instanceFor(gl) : EMPTY;
};

/** Set by the monitor UI for the roots it renders outside the measured one. */
export const PerfContext = createContext<PerfInstance | null>(null);

/**
 * The instance a hook reads: the canvas named by `id`, else the monitor UI's
 * own, else the surrounding <Canvas>, else the first measured canvas.
 */
export function usePerfInstance(id?: string): PerfInstance {
  const provided = useContext(PerfContext);
  const root = useContext(r3fContext);
  const own =
    id !== undefined
      ? null
      : (provided ??
        (root ? instanceFor(root.getState().gl as AnyRenderer) : null));

  // Only a hook that has to look its canvas up re-renders when the list
  // changes.
  const found = useSyncExternalStore(
    subscribeRunning,
    () => (own ? null : resolve(id)),
    () => null,
  );

  return own ?? found ?? EMPTY;
}

export const usePerf = <S>(sel: (state: State) => S, id?: string) =>
  useStoreWithEqualityFn(usePerfInstance(id).store, sel, shallow);
