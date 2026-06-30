// ── UI mặc định ──────────────────────────────────────────────
export { PerfMonitor } from "./components/PerfMonitor";

// ── Headless / Bring your own UI ─────────────────────────────
/**
 * Chạy đo, không render UI. Đặt trong <Canvas>.
 * Nhận `fpsTiers` + `onTierChange` để adaptive quality theo FPS.
 */
export { PerfHeadless } from "./components/PerfHeadless";

/**
 * Hook đọc số liệu để tự dựng UI.
 * - `usePerfData()` → toàn bộ { fps, cpu, gpu, mem, vram, gl, infos }.
 * - `usePerfData(d => d.fps)` → lấy đúng field cần (chỉ re-render khi field đổi).
 */
export { usePerfData, type PerfData } from "./hooks/usePerfData";
