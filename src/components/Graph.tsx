import { type FC, useEffect, useMemo, useRef } from "react";
import { matriceCount, matriceWorldCount } from "./PerfHeadless";
import { Canvas, useFrame, useThree, type Viewport } from "@react-three/fiber";
import { PerfContext, usePerfInstance, type State } from "../store";
import * as THREE from "three";
import type { PerfUIProps } from "../types";
import styles from "../style/tab.module.css";
import { colorsGraph, fpsAxisTop } from "./Utils";

export interface graphData {
  curve: THREE.SplineCurve;
  maxVal: number;
  element: string;
}

const ChartCurve: FC<PerfUIProps> = ({
  minimal,
  chart = { length: 120, hz: 60 },
}) => {
  const curves: any = useMemo(() => {
    return {
      fps: new Float32Array(chart.length * 3),
      cpu: new Float32Array(chart.length * 3),
      gpu: new Float32Array(chart.length * 3),
    };
  }, [chart]);

  const { getState: getPerf } = usePerfInstance().store;

  const fpsRef = useRef<any>(null);
  const gpuRef = useRef<any>(null);
  const cpuRef = useRef<any>(null);

  const dummyVec3 = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  // Top of the FPS axis: grows on high refresh rates, never shrinks
  const fpsTop = useRef(100);

  // Recompute positions from viewport (w, h) so the graph stretches with the canvas.
  const updatePoints = (
    element: string,
    factor: number = 1,
    ref: any,
    viewport: Viewport,
    top: number = 100,
  ) => {
    let maxVal = 0;
    const { width: w, height: h } = viewport;

    const chart = getPerf().chart.data[element];
    if (!chart || chart.length === 0) {
      return maxVal;
    }
    const padding = minimal ? 2 : 6;
    const paddingTop = minimal ? 2 : 6;
    const len = chart.length;
    for (let i = 0; i < len; i++) {
      const id = (getPerf().chart.circularId + i + 1) % len;
      if (chart[id] !== undefined) {
        if (chart[id] > maxVal) {
          maxVal = chart[id] * factor;
        }
        // X spans the full viewport width
        dummyVec3.set(
          padding + (i / (len - 1)) * (w - padding * 2) - w / 2,
          ((Math.min(top, chart[id]) * factor) / top) *
            (h - padding * 2 - paddingTop) -
            h / 2,
          0,
        );

        dummyVec3.toArray(ref.attributes.position.array, i * 3);
      }
    }

    ref.attributes.position.needsUpdate = true;
    return maxVal;
  };

  useFrame(function updateChartCurve({ viewport }) {
    const maxFps = updatePoints(
      "fps",
      1,
      fpsRef.current,
      viewport,
      fpsTop.current,
    );
    fpsTop.current = Math.max(fpsTop.current, fpsAxisTop(maxFps, 100));
    updatePoints("gpu", 5, gpuRef.current, viewport);
    updatePoints("cpu", 5, cpuRef.current, viewport);
  });

  return (
    <>
      <line
        // @ts-ignore
        onUpdate={(self: any) => {
          self.updateMatrix();
          matriceCount.value -= 1;
          self.matrixWorld.copy(self.matrix);
        }}
      >
        <bufferGeometry ref={fpsRef}>
          <bufferAttribute
            attach={"attributes-position"}
            count={chart.length}
            args={[curves.fps, 3]}
            array={curves.fps}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
            needsUpdate
          />
        </bufferGeometry>
        <lineBasicMaterial color={colorsGraph.fps} transparent opacity={0.5} />
      </line>
      <line
        // @ts-ignore
        onUpdate={(self: any) => {
          self.updateMatrix();
          matriceCount.value -= 1;
          self.matrixWorld.copy(self.matrix);
        }}
      >
        <bufferGeometry ref={gpuRef}>
          <bufferAttribute
            attach={"attributes-position"}
            count={chart.length}
            array={curves.gpu}
            args={[curves.gpu, 3]}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
            needsUpdate
          />
        </bufferGeometry>
        <lineBasicMaterial color={colorsGraph.gpu} transparent opacity={0.5} />
      </line>
      <line
        // @ts-ignore
        onUpdate={(self: any) => {
          self.updateMatrix();
          matriceCount.value -= 1;
          self.matrixWorld.copy(self.matrix);
        }}
      >
        <bufferGeometry ref={cpuRef}>
          <bufferAttribute
            attach={"attributes-position"}
            count={chart.length}
            array={curves.cpu}
            args={[curves.cpu, 3]}
            itemSize={3}
            usage={THREE.DynamicDrawUsage}
            needsUpdate
          />
        </bufferGeometry>
        <lineBasicMaterial color={colorsGraph.cpu} transparent opacity={0.5} />
      </line>
    </>
  );
};

export const ChartUI: FC<PerfUIProps> = ({
  chart,
  showGraph = true,
  antialias = true,
  minimal,
}) => {
  const canvas = useRef<any>(undefined);
  const perf = usePerfInstance();

  return (
    <div
      className={styles.graph}
      style={{
        height: `${minimal ? 30 : showGraph ? 52 : 46}px`,
      }}
    >
      <Canvas
        ref={canvas}
        frameloop="never"
        orthographic
        camera={{ rotation: [0, 0, 0] }}
        dpr={antialias ? [1, 2] : 1}
        gl={{
          antialias: true,
          alpha: true,
          stencil: false,
          depth: false,
        }}
        onCreated={({ scene }) => {
          scene.traverse((obj: THREE.Object3D) => {
            obj.matrixWorldAutoUpdate = false;
            obj.matrixAutoUpdate = false;
          });
        }}
        flat={true}
        style={{
          pointerEvents: "none",
          background: "transparent !important",
          width: "100%",
          height: "100%",
        }}
      >
        {/* Another React root: hand the monitored canvas down */}
        <PerfContext.Provider value={perf}>
          <ChartDriver />
          <Renderer />
          {showGraph && <ChartCurve minimal={minimal} chart={chart} />}
        </PerfContext.Provider>
      </Canvas>
    </div>
  );
};
const Renderer = () => {
  useFrame(function updateR3FPerf({ gl, scene, camera }) {
    camera.updateMatrix();
    matriceCount.value -= 1;
    camera.matrixWorld.copy(camera.matrix);
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    gl.render(scene, camera);
    matriceWorldCount.value = 0;
    matriceCount.value = 0;
  }, Infinity);

  return null;
};

/**
 * Renders the chart root via its own rAF (frameloop="never").
 * An "always" root keeps R3F's global loop running: demand scenes never idle,
 * addTail never fires, and the sampler ends up measuring this canvas.
 * advance(t, false) renders this root only, without global effects.
 */
const CHART_INTERVAL = 1000 / 30;
const ChartDriver = () => {
  const advance = useThree((s) => s.advance);
  const { getState: getPerf } = usePerfInstance().store;
  // Resizing clears the drawing buffer: restart the effect to redraw once.
  const size = useThree((s) => s.size);

  useEffect(() => {
    let raf = 0;
    let last = 0;
    let lastChart: State["chart"] | undefined;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      // Redraw on new chart data, not on `paused`: an isolated demand frame
      // flips it false -> true within one tick, so React never sees it.
      const chart = getPerf().chart;
      if (chart === lastChart) return;
      if (t - last < CHART_INTERVAL) return;
      last = t;
      lastChart = chart;
      advance(t, false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [advance, size, getPerf]);

  return null;
};
