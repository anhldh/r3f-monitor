import { type FC, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";

import { acquirePerf, beginRootFrame } from "../perfCore";
import type { PerfProps } from "../types";

// Re-export for legacy code (e.g. Graph.tsx) — matrix counters now live in perfCore
export { matriceCount, matriceWorldCount } from "../perfCore";

/**
 * Thin React wrapper around perfCore (StrictMode-safe).
 *
 * perfCore keeps one ref-counted core per canvas, so mounting several
 * instances in a canvas (e.g. <PerfHeadless /> + <PerfMonitor />) still runs
 * ONE core; it's disposed when the last instance unmounts.
 *
 * With several instances: `deepAnalyze` / `matrixUpdate` are ON if any instance
 * enables them (live); `logsPerSecond` / `chart` come from the first instance.
 */
export const PerfHeadless: FC<PerfProps> = ({
  id,
  logsPerSecond,
  chart,
  deepAnalyze,
  matrixUpdate,
}) => {
  const { gl, scene } = useThree();

  const chartLength = chart?.length;
  const chartHz = chart?.hz;

  useEffect(
    () =>
      acquirePerf(gl, scene, {
        id,
        logsPerSecond,
        deepAnalyze,
        matrixUpdate,
        chart:
          chartLength !== undefined && chartHz !== undefined
            ? { length: chartLength, hz: chartHz }
            : undefined,
      }),
    [
      gl,
      scene,
      id,
      logsPerSecond,
      chartLength,
      chartHz,
      deepAnalyze,
      matrixUpdate,
    ],
  );

  // Negative priority: runs before the scene's own useFrame callbacks without
  // taking over rendering.
  useFrame(() => beginRootFrame(gl), -Infinity);

  return null;
};
