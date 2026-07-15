export type AdaptiveCallbacks = {
  /** Khi hiệu năng cao hơn upper bound (tốt) */
  onIncline?: (engine: AdaptiveEngine) => void;
  /** Khi hiệu năng thấp hơn lower bound (xấu) */
  onDecline?: (engine: AdaptiveEngine) => void;
  /** Khi factor thay đổi (do incline/decline) */
  onChange?: (engine: AdaptiveEngine) => void;
  /** Khi số flipflops vượt ngưỡng — hệ thống không ổn định, nên set baseline cố định */
  onFallback?: (engine: AdaptiveEngine) => void;
};

export type AdaptiveEngineOptions = AdaptiveCallbacks & {
  /** Số mẫu FPS gom lại trước mỗi lần ra quyết định, 10 */
  iterations?: number;
  /** Tỉ lệ mẫu phải vượt bound để trigger incline/decline, 0.75 */
  threshold?: number;
  /** Bước cộng/trừ vào factor mỗi lần incline/decline, 0.1 */
  step?: number;
  /** Giá trị factor khởi điểm (0-1), 0.5 */
  factor?: number;
  /** Số lần incline/decline tối đa trước khi fallback, Infinity */
  flipflops?: number;
  /** Nhận refreshrate, trả [lower, upper] — vùng giữa 2 bound là vùng ổn định */
  bounds?: (refreshrate: number) => [lower: number, upper: number];
};

/**
 * Logic adaptive quality thuần (không React, không đo đạc).
 * Nhận mẫu FPS từ ngoài qua `addSample()`, tự quyết định incline/decline
 * và cập nhật `factor` (0-1). Port từ drei <PerformanceMonitor>.
 */
export class AdaptiveEngine {
  iterations: number;
  threshold: number;
  step: number;
  flipflops: number;
  bounds: (refreshrate: number) => [lower: number, upper: number];

  onIncline?: (engine: AdaptiveEngine) => void;
  onDecline?: (engine: AdaptiveEngine) => void;
  onChange?: (engine: AdaptiveEngine) => void;
  onFallback?: (engine: AdaptiveEngine) => void;

  /** FPS của mẫu gần nhất */
  fps = 0;
  /** GPU time (ms) của mẫu gần nhất — so với `cpu` để biết đang GPU-bound hay CPU-bound */
  gpu = 0;
  /** CPU time (ms) của mẫu gần nhất */
  cpu = 0;
  /** Hệ số chất lượng hiện tại, 0-1 */
  factor: number;
  /** Ước lượng refresh rate màn hình: max(seed từ detectRefreshRate, FPS cao nhất từng thấy) */
  refreshrate = 0;
  /** Các mẫu FPS trong lượt đánh giá hiện tại */
  averages: number[] = [];
  index = 0;
  flipped = 0;
  fallback = false;

  private lastFactor: number;
  private subscriptions = new Map<symbol, AdaptiveCallbacks>();

  constructor({
    iterations = 10,
    threshold = 0.75,
    step = 0.1,
    factor = 0.5,
    flipflops = Infinity,
    bounds = (refreshrate) => (refreshrate > 100 ? [60, 100] : [40, 60]),
    onIncline,
    onDecline,
    onChange,
    onFallback,
  }: AdaptiveEngineOptions = {}) {
    this.iterations = iterations;
    this.threshold = threshold;
    this.step = step;
    this.factor = factor;
    this.lastFactor = factor;
    this.flipflops = flipflops;
    this.bounds = bounds;
    this.onIncline = onIncline;
    this.onDecline = onDecline;
    this.onChange = onChange;
    this.onFallback = onFallback;
  }

  /** Seed refreshrate từ nguồn đo ngoài (vd detectRefreshRate) — chỉ tăng, không giảm. */
  seedRefreshrate(hz: number) {
    this.refreshrate = Math.max(this.refreshrate, hz);
  }

  /** Đăng ký callbacks phụ (cho hook). Trả về hàm unsubscribe. */
  subscribe(callbacks: AdaptiveCallbacks) {
    const key = Symbol();
    this.subscriptions.set(key, callbacks);
    return () => void this.subscriptions.delete(key);
  }

  /** Nạp một mẫu. Đủ `iterations` mẫu thì đánh giá và reset. gpu/cpu (ms) tuỳ chọn, chỉ để tham khảo trong callbacks. */
  addSample(fps: number, gpu = 0, cpu = 0) {
    if (this.fallback) return;

    this.fps = fps;
    this.gpu = gpu;
    this.cpu = cpu;
    this.refreshrate = Math.max(this.refreshrate, fps);
    this.averages[this.index++ % this.iterations] = fps;

    if (this.averages.length < this.iterations) return;

    const [lower, upper] = this.bounds(this.refreshrate);
    const upperCount = this.averages.filter((v) => v >= upper).length;
    const lowerCount = this.averages.filter((v) => v < lower).length;

    // Incline: đa số mẫu vượt upper bound -> tăng chất lượng
    if (upperCount > this.iterations * this.threshold) {
      this.factor = Math.min(1, this.factor + this.step);
      this.flipped++;
      this.emit("onIncline");
    }
    // Decline: đa số mẫu dưới lower bound -> giảm chất lượng
    if (lowerCount > this.iterations * this.threshold) {
      this.factor = Math.max(0, this.factor - this.step);
      this.flipped++;
      this.emit("onDecline");
    }

    if (this.lastFactor !== this.factor) {
      this.lastFactor = this.factor;
      this.emit("onChange");
    }

    if (this.flipped > this.flipflops && !this.fallback) {
      this.fallback = true;
      this.emit("onFallback");
    }

    this.averages = [];
  }

  private emit(name: keyof AdaptiveCallbacks) {
    this[name]?.(this);
    this.subscriptions.forEach((callbacks) => callbacks[name]?.(this));
  }
}
