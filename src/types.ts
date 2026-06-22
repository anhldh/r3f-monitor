import type { HTMLAttributes } from "react";
import type * as THREE from "three";
import type { PerfData } from "./hooks/usePerfData";

export type chart = {
  length: number;
  hz: number;
};

/** Renderer + scene mà lib đưa ra cho callback (lib lấy sẵn từ useThree). */
export type PerfContext = {
  gl: THREE.WebGLRenderer;
  scene: THREE.Scene;
  /** Số liệu hiện tại khi tier đổi. */
  data: PerfData;
};

/**
 * Gọi MỘT lần khi FPS chuyển tier (không phải mỗi mẫu).
 * @param tier Chỉ số tier: 0 = thấp nhất. Với `fpsTiers=[30,60]` → 0:<30, 1:30–60, 2:>60.
 */
export type TierChangeHandler = (tier: number, ctx: PerfContext) => void;

export interface PerfProps {
  logsPerSecond?: number;
  matrixUpdate?: boolean;
  chart?: chart;
  deepAnalyze?: boolean;
  /**
   * Các mốc FPS chia thành tier, tăng dần. Vd `[30, 60]` → 3 tier (0/1/2).
   * Bắt buộc đi kèm `onTierChange`.
   */
  fpsTiers?: number[];
  /**
   * FPS phải ở trong dải tier mới liên tục đủ lâu (ms) mới đổi tier.
   * Chống hạ/nâng oan do spike. Mặc định 5000.
   */
  tierDelay?: number;
  /**
   * Vùng đệm quanh mỗi mốc (chống giật): xuống khi `< mốc - margin`,
   * lên khi `> mốc + margin`. Mặc định 3.
   */
  tierMargin?: number;
  /** Gọi MỘT lần khi tier đổi. Map tier → hành động là việc của bạn. */
  onTierChange?: TierChangeHandler;
}

export interface PerfPropsGui extends PerfProps {
  showGraph?: boolean;
  displayType?: "tab" | "classic";
  graphType?: "line" | "bar";
  antialias?: boolean;
  openByDefault?: boolean;
  position?: string;
  minimal?: boolean;
  className?: string;
  style?: object;
  perfContainerRef?: any;
}

export interface PerfUIProps extends HTMLAttributes<HTMLDivElement> {
  perfContainerRef?: any;
  showGraph?: boolean;
  antialias?: boolean;
  chart?: chart;
  minimal?: boolean;
  matrixUpdate?: boolean;
}
