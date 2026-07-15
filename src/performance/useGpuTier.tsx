/* eslint-disable react-refresh/only-export-components */
import * as React from "react";
import {
  getGPUTier,
  type GetGPUTier,
  type TierResult,
} from "@pmndrs/detect-gpu";
import { suspend } from "suspend-react";

export const useGpuTier = (options?: GetGPUTier): TierResult =>
  suspend(
    () => getGPUTier(options),
    ["r3f-monitor/gpu-tier", JSON.stringify(options ?? {})],
  );

/** Drei-compatible alias — dùng `useGpuTier` cho code mới */
export const useDetectGPU = useGpuTier;

export type GpuTierProps = {
  children?: (result: TierResult) => React.ReactNode;
} & GetGPUTier;

export function GpuTier({ children, ...options }: GpuTierProps) {
  const result = useGpuTier(options);
  return <>{children?.(result)}</>;
}
