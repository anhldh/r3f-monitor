import * as React from "react";
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { addEffect } from "@react-three/fiber";
import { useEvent } from "../events/react";
import { detectRefreshRate } from "./detectRefreshRate";
import {
  AdaptiveEngine,
  type AdaptiveCallbacks,
  type AdaptiveEngineOptions,
} from "./AdaptiveEngine";

export type PerfAdaptiveProps = AdaptiveEngineOptions & {
  /** Children có thể dùng hook usePerfAdaptive */
  children?: React.ReactNode;
};

type LogSample = { fps: number; rawFps?: number; gpu: number; cpu: number };

const context = /* @__PURE__ */ createContext<AdaptiveEngine>(null!);

/**
 * Adaptive quality dựa trên số liệu đo của r3f-monitor.
 *
 * Cần <PerfHeadless /> (trực tiếp hoặc qua <PerfMonitor />) mounted trong
 * <Canvas> để có dữ liệu — giống usePerfData. Mỗi tick log (theo nhịp
 * `logsPerSecond` của PerfHeadless) là 1 mẫu {fps, gpu, cpu} nạp vào engine.
 *
 * API tương thích drei <PerformanceMonitor>: dùng onIncline/onDecline/onChange
 * hoặc đọc `engine.factor` (0-1) để chỉnh dpr, shadow, effects... Trong
 * callbacks có thể so `engine.gpu` với `engine.cpu` để biết đang
 * GPU-bound (giảm dpr/effects có tác dụng) hay CPU-bound (nên giảm draw calls).
 */
export function PerfAdaptive({
  children,
  onIncline,
  onDecline,
  onChange,
  onFallback,
  ...options
}: PerfAdaptiveProps) {
  const [engine] = useState(() => new AdaptiveEngine(options));

  // Seed refreshrate sớm bằng nhịp rAF — tránh case scene nặng từ đầu khiến
  // engine không bao giờ "thấy" FPS cao và học sai tần số màn hình.
  // Max-fps learning vẫn chạy song song (chỉ tăng, không giảm).
  useEffect(() => {
    detectRefreshRate().then((hz) => engine.seedRefreshrate(hz));
  }, [engine]);

  // Đăng ký callbacks qua subscribe (luôn dùng bản mới nhất từ props)
  const callbacksRef = useRef<AdaptiveCallbacks>({
    onIncline,
    onDecline,
    onChange,
    onFallback,
  });
  useLayoutEffect(() => {
    callbacksRef.current.onIncline = onIncline;
    callbacksRef.current.onDecline = onDecline;
    callbacksRef.current.onChange = onChange;
    callbacksRef.current.onFallback = onFallback;
  }, [onIncline, onDecline, onChange, onFallback]);
  useLayoutEffect(() => engine.subscribe(callbacksRef.current), [engine]);

  // Nguồn dữ liệu duy nhất: event "log" do PerfHeadless bắn ra.
  // Khi paused (tab ẩn / loop dừng) paramLogger ngừng bắn -> không có mẫu oan.
  // Ưu tiên rawFps (chưa qua EMA) để phát hiện tụt FPS nhanh; UI vẫn dùng fps smooth.
  //
  // Event "log" bắn từ addAfterEffect (SAU khi frame đã vẽ) — nếu chạy callbacks
  // ngay tại đó, setDpr sẽ resize (xoá trắng) buffer sau render -> nháy 1 frame.
  // Nên chỉ queue mẫu ở đây, và flush trong addEffect (TRƯỚC render) để mọi
  // thay đổi của user luôn được vẽ đè ngay trong cùng frame — giống drei.
  const queue = useRef<LogSample[]>([]);
  useEvent("log", ([log]: [LogSample, unknown]) => {
    queue.current.push(log);
  });
  useEffect(
    () =>
      addEffect(() => {
        const samples = queue.current;
        if (samples.length === 0) return;
        queue.current = [];
        for (const log of samples) {
          engine.addSample(log.rawFps ?? log.fps, log.gpu, log.cpu);
        }
      }),
    [engine],
  );

  return <context.Provider value={engine}>{children}</context.Provider>;
}

/**
 * Hook cho children của <PerfAdaptive> — tương đương usePerformanceMonitor của drei.
 */
export function usePerfAdaptive({
  onIncline,
  onDecline,
  onChange,
  onFallback,
}: AdaptiveCallbacks) {
  const engine = useContext(context);
  const ref = useRef<AdaptiveCallbacks>({
    onIncline,
    onDecline,
    onChange,
    onFallback,
  });

  useLayoutEffect(() => {
    ref.current.onIncline = onIncline;
    ref.current.onDecline = onDecline;
    ref.current.onChange = onChange;
    ref.current.onFallback = onFallback;
  }, [onIncline, onDecline, onChange, onFallback]);

  useLayoutEffect(() => engine.subscribe(ref.current), [engine]);
}
