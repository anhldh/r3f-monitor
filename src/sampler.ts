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
  /** 0 until the first FPS measurement. */
  fps: number;
  /** FPS over the 1s window — used by adaptive quality. 0 until measured. */
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

// A frame counts as a stall (and dips the chart) only past this multiple of
// the windowed frame time, so ordinary rAF jitter doesn't draw as dips.
const STALL_FACTOR = 2;

// After the loop stops (demand mode), a wait longer than this before the next
// frame is idle time. Shorter waits are just the next vsync while interacting.
const IDLE_MS = 100;

// Rendering time the FPS window needs before it reports: averaging fewer
// intervals lets timestamp jitter read above the refresh rate.
const MIN_WINDOW_MS = 100;

const average = (arr: number[]) =>
  arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

/**
 * Renderer-agnostic sampling: FPS (1s sliding window), CPU wall-clock,
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
  // Parallel to frameTimes: the interval ending at that frame was idle time
  private frameAfterGap: boolean[] = [];
  private frameTimesHead = 0;
  // Last FPS measured over real rendering, held while the window has none
  private activeFps = 0;
  private lastFrameTime = 0;
  // Next frame follows an idle gap (start, demand mode, hidden tab):
  // its delta is idle time, not a stall.
  private afterGap = true;
  // When the loop last stopped, until the next frame starts
  private idleSince = 0;

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
   * FPS over a real 1s window (intervals * 1000 / time spent rendering), on
   * rAF timestamps: vsync-aligned, so render-time variance can't shorten an
   * interval. Intervals that end an idle gap are left out, so pausing a demand
   * loop doesn't read as low FPS. Returns a float (e.g. 120.3) to avoid +/-1
   * jitter, or 0 while nothing has been measured yet.
   */
  private calculateFps(t: number, afterGap: boolean): number {
    const cutoff = t - 1000;

    this.frameTimes.push(t);
    this.frameAfterGap.push(afterGap);

    while (
      this.frameTimesHead < this.frameTimes.length &&
      this.frameTimes[this.frameTimesHead] <= cutoff
    ) {
      this.frameTimesHead++;
    }

    // Compact to bound memory
    if (this.frameTimesHead > 128) {
      this.frameTimes = this.frameTimes.slice(this.frameTimesHead);
      this.frameAfterGap = this.frameAfterGap.slice(this.frameTimesHead);
      this.frameTimesHead = 0;
    }

    let intervals = 0;
    let elapsed = 0;
    for (let i = this.frameTimesHead + 1; i < this.frameTimes.length; i++) {
      if (this.frameAfterGap[i]) continue;
      intervals++;
      elapsed += this.frameTimes[i] - this.frameTimes[i - 1];
    }

    // Too little continuous rendering in the window (just started or resumed
    // from idle): hold the last measurement, or 0 = unknown before the first
    if (elapsed < MIN_WINDOW_MS) return this.activeFps;

    this.activeFps = (intervals * 1000) / elapsed;
    return this.activeFps;
  }

  /**
   * Call when the loop stops (R3F tail). If the next frame starts more than
   * IDLE_MS later, that wait is idle time: it isn't plotted as a stall or
   * counted in the FPS window. In demand mode the tail also runs between
   * frames while interacting, so a short wait still counts as frame time.
   */
  markIdle() {
    this.idleSince = this.now();
  }

  /**
   * The next frame follows a gap no matter how long (tab hidden).
   * Neither call rebases chart/log timing: isolated demand frames rely on
   * that backfill to show up at all.
   */
  markGap() {
    this.afterGap = true;
  }

  /** Start wall-clock timing of the render pass. */
  begin() {
    this.cpuStartTime = this.now();

    if (this.idleSince > 0) {
      if (this.cpuStartTime - this.idleSince > IDLE_MS) this.afterGap = true;
      this.idleSince = 0;
    }
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

    const afterGap = this.afterGap;
    this.afterGap = false;

    const rawFps = this.calculateFps(t, afterGap);
    // Dip only on a clear stall (not idle), never above the windowed FPS
    const delta = t - this.lastFrameTime;
    const frameFps =
      !afterGap && rawFps > 0 && delta > (STALL_FACTOR * 1000) / rawFps
        ? Math.min(1000 / delta, rawFps)
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
      // 0 = no FPS measured yet: leave it out of the average
      if (rawFps > 0) {
        this.logsAccums.fps.push(rawFps);
        this.logsAccums.rawFps.push(rawFps);
      }
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

    this.pushChart(t, frameFps, cpu, gpu);
  }

  private pushChart(t: number, fps: number, cpu: number, gpu: number) {
    if (!this.chartFrame) {
      this.chartFrame = this.frameId;
      this.chartTime = t;
      this.circularId = 0;
      return;
    }

    const timespan = t - this.chartTime;
    let hz = Math.min(this.chartLen + 1, (this.chartHz * timespan) / 1e3);

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
    this.frameAfterGap.length = 0;
    this.frameTimesHead = 0;
    this.activeFps = 0;
    this.lastFrameTime = 0;
    this.afterGap = true;
    this.idleSince = 0;
    this.totalCpuDuration = 0;
  }
}
