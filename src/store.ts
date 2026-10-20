import { createWithEqualityFn } from "zustand/traditional";
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
  programs: ProgramsPerfs;
  /** Per-pass timings (deepAnalyze on WebGPU, three r181+). */
  passes: PassStats[];
  objectWithMaterials: THREE.Mesh[] | null;
  tab: "infos" | "programs" | "data";
};

export type ProgramsPerfs = Map<string, ProgramsPerf>;

const setCustomData = (customData: number) => {
  setPerf({ customData });
};
const getCustomData = () => {
  return getPerf().customData;
};

export const usePerfImpl = createWithEqualityFn<State>((_set, get): any => {
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
    programs: new Map(),
    sceneLength: undefined,
    tab: "infos",
    getReport,
  };
});

const usePerf = <S>(sel: (state: State) => S) => usePerfImpl(sel, shallow);
Object.assign(usePerf, usePerfImpl);
const { getState: getPerf, setState: setPerf } = usePerfImpl;

export { usePerf, getPerf, setPerf, setCustomData, getCustomData };
