/* eslint-disable react-refresh/only-export-components */
import { type FC, useEffect } from "react";
import { useThree } from "@react-three/fiber";

import { acquirePerf } from "../perfCore";
import type { PerfProps } from "../types";

// Re-export cho code cũ (vd Graph.tsx) — bộ đếm matrix update giờ sống trong perfCore
export { matriceCount, matriceWorldCount } from "../perfCore";

/**
 * Vỏ React mỏng quanh perfCore (StrictMode-safe).
 *
 * Logic đo nằm trong perfCore — singleton ref-counted, nên mount nhiều
 * instance cùng lúc (vd <PerfHeadless /> + <PerfMonitor />) vẫn chỉ có
 * MỘT hệ đo chạy; instance cuối cùng unmount mới dispose.
 */
export const PerfHeadless: FC<PerfProps> = ({
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
        logsPerSecond,
        deepAnalyze,
        matrixUpdate,
        chart:
          chartLength !== undefined && chartHz !== undefined
            ? { length: chartLength, hz: chartHz }
            : undefined,
      }),
    [gl, scene, logsPerSecond, chartLength, chartHz, deepAnalyze, matrixUpdate],
  );

  return null;
};
