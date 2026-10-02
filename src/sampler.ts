declare global {
  interface Performance {
    memory: any;
  }
}

type LogsAccums = {
  mem: number[];
  gpu: number[];
  gpuCompute: number[];
  cpu: number[];
  fps: number[];
  rawFps: number[];
};

export type SampleLog = {
  cpu: number;
  gpu: number;
  gpuCompute: number;
  mem: number;
  fps: number;
  /** FPS before EMA smoothing — lets adaptive quality react faster. */
  rawFps: number;
  duration: number;
  maxMemory: number;
  frameCount: number;
};

export type SampleChart = {
  data: { [index: string]: number[] };
  i: number;
  circularId: number;
};

export type SamplerOptions = {
  chartLen?: number;
  chartHz?: number;
  logsPerSecond?: number;
  paramLogger?: (log: SampleLog) => void;
  chartLogger?: (chart: SampleChart) => void;
};

const average = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

/**
 * Renderer-agnostic sampling: FPS (1s sliding window + EMA), CPU wall-clock,
 * `logsPerSecond` throttling and a circular chart buffer.
 *
 * GPU timings are read by the backend and passed to `nextFrame()`, so WebGL
 * and WebGPU share the same math.
 *
 * (Extracted from v2's `GLPerf` in internal.ts.)
 */
export class PerfSampler {
  paused = false;

  chartLen = 120;
  chartHz = 60;
  logsPerSecond = 10;
  maxMemory = 1500;

  paramLogger: (log: SampleLog) => void = () => {};
  chartLogger: (chart: SampleChart) => void = () => {};

  currentMem = 0;

  private fpsChart: number[];
  private gpuChart: number[];
  private cpuChart: number[];
  private memChart: number[];

  private frameId = 0;
  private paramFrame = 0;
  private paramTime = 0;
  private chartFrame = 0;
  private chartTime = 0;
  private circularId = 0;

  private logsAccums: LogsAccums = {
    mem: [],
    gpu: [],
    gpuCompute: [],
    cpu: [],
    fps: [],
    rawFps: [],
  };

  // FPS: 1s sliding window
  private frameTimes: number[] = [];
  private frameTimesHead = 0;
  private lastFrameTime = 0;

  // CPU: accumulated performance.now() deltas
  private cpuStartTime = 0;
  private totalCpuDuration = 0;

  constructor(options: SamplerOptions = {}) {
    Object.assign(this, options);

    this.fpsChart = new Array(this.chartLen).fill(0);
    this.gpuChart = new Array(this.chartLen).fill(0);
    this.cpuChart = new Array(this.chartLen).fill(0);
    this.memChart = new Array(this.chartLen).fill(0);
  }

  private now() {
    return window.performance?.now ? window.performance.now() : Date.now();
  }

  /**
   * FPS over a real 1s window (frameCount * 1000 / elapsed).
   * Returns a float (e.g. 120.3) to avoid +/-1 jitter.
   */
  private calculateFps(): number {
    const currentTime = this.now();
    const cutoff = currentTime - 1000;

    this.frameTimes.push(currentTime);

    while (
      this.frameTimesHead < this.frameTimes.length &&
      this.frameTimes[this.frameTimesHead] <= cutoff
    ) {
      this.frameTimesHead++;
    }

    // Compact to bound memory
    if (this.frameTimesHead > 128) {
      this.frameTimes = this.frameTimes.slice(this.frameTimesHead);
      this.frameTimesHead = 0;
    }

    const count = this.frameTimes.length - this.frameTimesHead;
    if (count < 2) return count;

    const oldest = this.frameTimes[this.frameTimesHead];
    const elapsed = currentTime - oldest;
    if (elapsed <= 0) return count;

    // (count - 1) intervals over elapsed ms
    return ((count - 1) * 1000) / elapsed;
  }

  /**
   * Call when the loop restarts after idle (frameloop="demand", hidden tab, ...).
   * Rebases timestamps to now so the idle gap isn't logged and pushChart
   * doesn't backfill hundreds of chart slots in one frame.
   */
  resume() {
    const t = this.now();
    this.paramTime = t;
    this.paramFrame = this.frameId;
    this.chartTime = t;
    this.lastFrameTime = 0;
    this.totalCpuDuration = 0;
    this.logsAccums = {
      mem: [],
      gpu: [],
      gpuCompute: [],
      cpu: [],
      fps: [],
      rawFps: [],
    };
  }

  /** Start wall-clock timing of the render pass. */
  begin() {
    this.cpuStartTime = this.now();
  }

  /** Accumulate wall-clock into the frame's CPU total. */
  end() {
    this.totalCpuDuration += this.now() - this.cpuStartTime;
  }

  /**
   * Finalize a frame. `gpu`/`gpuCompute` are in ms, provided by the backend.
   */
  nextFrame(now: number, gpu: number, gpuCompute: number) {
    this.frameId++;
    const t = now || this.now();
    const duration = t - this.paramTime;

    const rawFps = this.calculateFps();
    // Per-frame FPS for display, so single slow frames show up in the chart
    const fps =
      this.lastFrameTime > 0 && t > this.lastFrameTime
        ? 1000 / (t - this.lastFrameTime)
        : rawFps;
    this.lastFrameTime = t;
    const cpu = this.totalCpuDuration;

    if (this.frameId <= 1) {
      this.paramFrame = this.frameId;
      this.paramTime = t;
    } else if (t >= this.paramTime) {
      this.maxMemory = window.performance.memory
        ? window.performance.memory.jsHeapSizeLimit / 1048576
        : 0;
      const frameCount = this.frameId - this.paramFrame;

      this.currentMem = Math.round(
        window.performance?.memory
          ? window.performance.memory.usedJSHeapSize / 1048576
          : 0,
      );

      this.logsAccums.mem.push(this.currentMem);
      this.logsAccums.fps.push(fps);
      this.logsAccums.rawFps.push(rawFps);
      this.logsAccums.gpu.push(gpu);
      this.logsAccums.gpuCompute.push(gpuCompute);
      this.logsAccums.cpu.push(cpu);

      if (t >= this.paramTime + 1000 / this.logsPerSecond) {
        this.paramLogger({
          cpu: average(this.logsAccums.cpu),
          gpu: average(this.logsAccums.gpu),
          gpuCompute: average(this.logsAccums.gpuCompute),
          mem: average(this.logsAccums.mem),
          fps: average(this.logsAccums.fps),
          rawFps: average(this.logsAccums.rawFps),
          duration: Math.round(duration),
          maxMemory: this.maxMemory,
          frameCount,
        });

        this.logsAccums.mem = [];
        this.logsAccums.fps = [];
        this.logsAccums.rawFps = [];
        this.logsAccums.gpu = [];
        this.logsAccums.gpuCompute = [];
        this.logsAccums.cpu = [];

        this.paramFrame = this.frameId;
        this.paramTime = t;
      }
    }

    // reset accumulated CPU for the next frame
    this.totalCpuDuration = 0;

    this.pushChart(t, fps, cpu, gpu);
  }

  private pushChart(t: number, fps: number, cpu: number, gpu: number) {
    if (!this.chartFrame) {
      this.chartFrame = this.frameId;
      this.chartTime = t;
      this.circularId = 0;
      return;
    }

    const timespan = t - this.chartTime;
    let hz = (this.chartHz * timespan) / 1e3;

    while (--hz > 0) {
      const slot = this.circularId % this.chartLen;
      this.fpsChart[slot] = fps;

      const memS = 1000 / this.currentMem;
      if (gpu > 0) this.gpuChart[slot] = gpu;
      if (cpu > 0) this.cpuChart[slot] = cpu;
      if (memS > 0) this.memChart[slot] = memS;

      this.chartLogger({
        i: 0,
        data: {
          fps: this.fpsChart,
          gpu: this.gpuChart,
          cpu: this.cpuChart,
          mem: this.memChart,
        },
        circularId: this.circularId,
      });

      this.circularId++;
      this.chartFrame = this.frameId;
      this.chartTime = t;
    }
  }

  dispose() {
    this.frameTimes.length = 0;
    this.frameTimesHead = 0;
    this.lastFrameTime = 0;
    this.totalCpuDuration = 0;
  }
}
