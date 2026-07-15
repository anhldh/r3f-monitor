import { addAfterEffect, addEffect, addTail } from "@react-three/fiber";
import * as THREE from "three";

import { GLPerf } from "./internal";
import { countGeoDrawCalls } from "./helpers/countGeoDrawCalls";
import { getPerf, type ProgramsPerfs, setPerf } from "./store";
import type { PerfProps } from "./types";
import { emitEvent } from "./events/vanilla";
import { estimateMemory } from "./helpers/estimateMemory";

const updateMatrixWorldTemp = THREE.Object3D.prototype.updateMatrixWorld;
const updateWorldMatrixTemp = THREE.Object3D.prototype.updateWorldMatrix;
const updateMatrixTemp = THREE.Object3D.prototype.updateMatrix;

const maxGl = ["calls", "triangles", "points", "lines"] as const;
const maxLog = ["gpu", "cpu", "mem", "fps"] as const;

export const matriceWorldCount = { value: 0 };
export const matriceCount = { value: 0 };

const isUUID = (uuid: string) =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    uuid,
  );

const addMuiPerfID = (
  material: THREE.Material,
  currentObjectWithMaterials: any,
) => {
  material.defines ||= {};
  if (!material.defines.muiPerf) {
    material.defines = Object.assign(material.defines || {}, {
      muiPerf: material.uuid,
    });
    material.needsUpdate = true;
  }

  const uuid = material.uuid;
  if (!currentObjectWithMaterials[uuid]) {
    currentObjectWithMaterials[uuid] = { meshes: {}, material };
  }
  material.needsUpdate = false;
  return uuid;
};

type Chart = {
  data: { [index: string]: number[] };
  id: number;
  circularId: number;
};

const getMUIIndex = (muid: string) => muid === "muiPerf";

/**
 * Core đo hiệu năng — singleton ref-counted, không dính React.
 *
 * `acquirePerf()` lần đầu sẽ khởi tạo GLPerf + hook vào render loop;
 * các lần acquire sau chỉ tăng biến đếm (core không thuộc về consumer nào).
 * Hàm release trả về giảm đếm; về 0 thì dispose sạch. Nhờ đó mount
 * <PerfHeadless /> lẫn <PerfMonitor /> cùng lúc vẫn chỉ có MỘT hệ đo.
 */
let refCount = 0;
let current: {
  gl: THREE.WebGLRenderer;
  options: PerfProps;
  dispose: () => void;
} | null = null;

export function acquirePerf(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  options: PerfProps = {},
): () => void {
  refCount++;

  if (!current) {
    current = { gl, options, dispose: createCore(gl, scene, options) };
  } else {
    if (current.gl !== gl) {
      console.warn(
        "[r3f-monitor] acquirePerf: core đang đo trên renderer khác — chưa hỗ trợ multi-canvas, dùng core hiện tại.",
      );
    } else if (
      current.options.logsPerSecond !== options.logsPerSecond ||
      current.options.deepAnalyze !== options.deepAnalyze ||
      current.options.matrixUpdate !== options.matrixUpdate ||
      current.options.chart?.length !== options.chart?.length ||
      current.options.chart?.hz !== options.chart?.hz
    ) {
      console.warn(
        "[r3f-monitor] acquirePerf: đã có core chạy với options khác — options của instance đầu tiên được giữ.",
      );
    }
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount--;
    if (refCount === 0 && current) {
      current.dispose();
      current = null;
    }
  };
}

/** Khởi tạo toàn bộ hệ đo. Trả về hàm dispose. (Port 1:1 từ PerfHeadless cũ) */
function createCore(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  { logsPerSecond, chart, deepAnalyze, matrixUpdate }: PerfProps,
): () => void {
  setPerf({ gl, scene });

  const memoryUpdateRate = 1000;
  let lastMemoryUpdate = 0;

  const PerfLib = new GLPerf({
    trackGPU: true,
    chartLen: chart ? chart.length : 120,
    chartHz: chart ? chart.hz : 60,
    logsPerSecond: logsPerSecond || 10,
    gl: gl.getContext(),

    chartLogger: (chart: Chart) => {
      setPerf({ chart });
    },

    paramLogger: (logger: any) => {
      const log = {
        maxMemory: logger.maxMemory,
        gpu: logger.gpu,
        cpu: logger.cpu,
        mem: logger.mem,
        fps: logger.fps,
        rawFps: logger.rawFps,
        totalTime: logger.duration,
        frameCount: logger.frameCount,
      };

      setPerf({ log });

      const { accumulated }: any = getPerf();
      const glRender: any = gl.info.render;

      accumulated.totalFrames++;
      accumulated.gl.calls += glRender.calls;
      accumulated.gl.triangles += glRender.triangles;
      accumulated.gl.points += glRender.points;
      accumulated.gl.lines += glRender.lines;

      accumulated.log.gpu += logger.gpu;
      accumulated.log.cpu += logger.cpu;
      accumulated.log.mem += logger.mem;
      accumulated.log.fps += logger.fps;

      for (let i = 0; i < maxGl.length; i++) {
        const key = maxGl[i];
        const value = glRender[key];
        if (value > accumulated.max.gl[key]) accumulated.max.gl[key] = value;
      }

      for (let i = 0; i < maxLog.length; i++) {
        const key = maxLog[i];
        const value = logger[key];
        if (value > accumulated.max.log[key]) accumulated.max.log[key] = value;
      }

      setPerf({ accumulated });

      const glInfo = {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        points: gl.info.render.points,
        lines: gl.info.render.lines,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length || 0,

        matrices: matriceCount.value + matriceWorldCount.value,
      };

      emitEvent("log", [log, glInfo]);
    },
  });

  // Infos (vendor/renderer)
  const ctx = gl.getContext();
  let glRenderer: string | null = null;
  let glVendor: string | null = null;

  const rendererInfo: any = ctx.getExtension("WEBGL_debug_renderer_info");
  const glVersion = ctx.getParameter(ctx.VERSION);

  if (rendererInfo) {
    glRenderer = ctx.getParameter(rendererInfo.UNMASKED_RENDERER_WEBGL);
    glVendor = ctx.getParameter(rendererInfo.UNMASKED_VENDOR_WEBGL);
  }

  glVendor ||= "Unknown vendor";
  glRenderer ||= ctx.getParameter(ctx.RENDERER);

  setPerf({
    startTime: window.performance.now(),
    infos: {
      version: glVersion,
      renderer: glRenderer as string,
      vendor: glVendor,
    },
  });

  // main hooks + optional deep analyze
  let unsubEffect: (() => void) | undefined;
  let unsubAfter: (() => void) | undefined;

  if (gl.info) {
    gl.info.autoReset = false;

    // optional: matrix update counting
    if (matrixUpdate) {
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
    }

    // PRE frame: reset stats + start CPU mark + GPU begin
    unsubEffect = addEffect(() => {
      if (getPerf().paused) setPerf({ paused: false });

      // GPU begin + CPU begin (statgl: performance.now())
      PerfLib.begin("profiler");

      matriceWorldCount.value = 0;
      matriceCount.value = 0;

      gl.info.reset();
    });

    // AFTER frame: GPU end + nextFrame + deepAnalyze
    unsubAfter = addAfterEffect(() => {
      // end GPU for the frame
      PerfLib.end("profiler");

      if (!PerfLib.paused) {
        PerfLib.nextFrame(window.performance.now());
      }

      const now = window.performance.now();

      // Count Vram
      if (now - lastMemoryUpdate > memoryUpdateRate) {
        lastMemoryUpdate = now;

        // Estimate VRAM
        const vramStats = estimateMemory(scene);

        // Memory Ram
        const jsMem = (PerfLib as any).currentMem || 0;

        // Save store
        setPerf({
          estimatedMemory: {
            vram: vramStats.total / 1024 / 1024, // MB
            tex: vramStats.texture / 1024 / 1024,
            geo: vramStats.geometry / 1024 / 1024,
            ram: jsMem, // MB
          },
        });
      }
      // ----------------------------------

      if (!deepAnalyze) return;

      const currentObjectWithMaterials: any = {};
      const programs: ProgramsPerfs = new Map();

      scene.traverse((object: any) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          if (!object.material) return;

          let uuid = object.material.uuid;
          const isTroika =
            Array.isArray(object.material) && object.material.length > 1;

          uuid = isTroika
            ? addMuiPerfID(object.material[1], currentObjectWithMaterials)
            : addMuiPerfID(object.material, currentObjectWithMaterials);

          currentObjectWithMaterials[uuid].meshes[object.uuid] = object;
        }
      });

      gl?.info?.programs?.forEach((program: any) => {
        const cacheKeySplited = program.cacheKey.split(",");
        const muiPerfTracker =
          cacheKeySplited[cacheKeySplited.findIndex(getMUIIndex) + 1];

        if (
          isUUID(muiPerfTracker) &&
          currentObjectWithMaterials[muiPerfTracker]
        ) {
          const { material, meshes } =
            currentObjectWithMaterials[muiPerfTracker];

          programs.set(muiPerfTracker, {
            program,
            material,
            meshes,
            drawCounts: { total: 0, type: "triangle", data: [] },
            expand: false,
            visible: true,
          });
        }
      });

      // NOTE: triggerProgramsUpdate++
      if (programs.size !== getPerf().programs.size) {
        countGeoDrawCalls(programs);
        setPerf({
          programs,
          triggerProgramsUpdate: getPerf().triggerProgramsUpdate + 1,
        });
      }
    });
  }

  // tail: when r3f stops rendering
  const unsubTail = addTail(() => {
    PerfLib.paused = true;
    matriceCount.value = 0;
    matriceWorldCount.value = 0;

    setPerf({
      paused: true,
      log: {
        maxMemory: 0,
        gpu: 0,
        mem: 0,
        cpu: 0,
        fps: 0,
        totalTime: 0,
        frameCount: 0,
      },
    });
    return false;
  });

  return () => {
    // dispose GPU query state
    PerfLib.dispose?.();

    // restore matrix prototypes
    if (matrixUpdate) {
      THREE.Object3D.prototype.updateMatrixWorld = updateMatrixWorldTemp;
      THREE.Object3D.prototype.updateWorldMatrix = updateWorldMatrixTemp;
      THREE.Object3D.prototype.updateMatrix = updateMatrixTemp;
    }

    unsubEffect?.();
    unsubAfter?.();
    unsubTail();
  };
}
