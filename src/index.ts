// ── UI mặc định ──────────────────────────────────────────────
export { PerfMonitor } from "./components/PerfMonitor";

// ── Headless / Bring your own UI ─────────────────────────────
/**
 * Chạy đo, không render UI. Đặt trong <Canvas>.
 * Kết hợp <PerfAdaptive /> để adaptive quality theo FPS.
 */
export { PerfHeadless } from "./components/PerfHeadless";

/**
 * Hook đọc số liệu để tự dựng UI.
 * - `usePerfData()` → toàn bộ { fps, cpu, gpu, mem, vram, gl, infos }.
 * - `usePerfData(d => d.fps)` → lấy đúng field cần (chỉ re-render khi field đổi).
 */
export { usePerfData, type PerfData } from "./hooks/usePerfData";

// ── Adaptive quality ─────────────────────────────────────────
/**
 * Điều chỉnh `factor` (0-1) để giảm/tăng chất lượng theo FPS.
 * Lấy số liệu {fps, gpu, cpu} từ PerfHeadless — cần <PerfHeadless /> trong
 * <Canvas> (giống usePerfData). API tương thích drei <PerformanceMonitor>.
 */
export {
  PerfAdaptive,
  usePerfAdaptive,
  type PerfAdaptiveProps,
} from "./performance/PerfAdaptive";
export {
  AdaptiveEngine,
  type AdaptiveEngineOptions,
  type AdaptiveCallbacks,
} from "./performance/AdaptiveEngine";
export { detectRefreshRate } from "./performance/detectRefreshRate";

// ── GPU tier ─────────────────────────────────────────────────
/**
 * Phát hiện tier GPU (0-3) qua @pmndrs/detect-gpu — chọn chất lượng
 * khởi điểm theo máy, rồi để PerfAdaptive tinh chỉnh runtime.
 * Hook suspend — component dùng nó cần nằm trong <Suspense>.
 */
export {
  useGpuTier,
  useDetectGPU,
  GpuTier,
  type GpuTierProps,
} from "./performance/useGpuTier";
