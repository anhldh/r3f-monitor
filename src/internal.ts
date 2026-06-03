import { MathUtils } from "three";

declare global {
  interface Window {
    GLPerf: any;
  }
  interface Performance {
    memory: any;
  }
}

interface QueryInfo {
  query: WebGLQuery;
}

interface LogsAccums {
  mem: number[];
  gpu: number[];
  cpu: number[];
  fps: number[];
}

const average = (arr: number[]) =>
  arr?.length ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : 0;

export class GLPerf {
  names: string[] = [""];
  gl: any;
  extension: any;
  paused: boolean = false;
  isWebGL2: boolean = true;
  logsAccums: LogsAccums = {
    mem: [],
    gpu: [],
    cpu: [],
    fps: [],
  };
  fpsChart: number[] = [];
  gpuChart: number[] = [];
  cpuChart: number[] = [];
  memChart: number[] = [];
  paramLogger: any = () => {};
  chartLogger: any = () => {};
  chartLen: number = 60;
  logsPerSecond: number = 10;
  maxMemory: number = 1500;
  chartHz: number = 10;
  chartFrame: number = 0;
  chartTime: number = 0;
  circularId: number = 0;
  frameId: number = 0;
  idleCbId: number = 0;
  uuid: string | undefined = undefined;
  currentCpu: number = 0;
  currentMem: number = 0;
  paramFrame: number = 0;
  paramTime: number = 0;
  now: any = () => {};

  // --- statgl FPS: sliding window 1s thật ---
  protected frameTimes: number[] = [];
  protected frameTimesHead = 0;
  protected smoothFps = 0; // EMA để số FPS không nhảy +/-1

  // --- statgl CPU: performance.now() cộng dồn ---
  protected cpuStartTime = 0;
  protected totalCpuDuration = 0;

  // --- statgl GPU: query queue (WebGL2 only) ---
  protected activeQuery: WebGLQuery | null = null;
  protected gpuQueries: QueryInfo[] = [];
  protected totalGpuDuration = 0;

  constructor(settings: object = {}) {
    window.GLPerf = window.GLPerf || {};

    Object.assign(this, settings);

    this.fpsChart = new Array(this.chartLen).fill(0);
    this.gpuChart = new Array(this.chartLen).fill(0);
    this.cpuChart = new Array(this.chartLen).fill(0);
    this.memChart = new Array(this.chartLen).fill(0);
    this.now = () =>
      window.performance && window.performance.now
        ? window.performance.now()
        : Date.now();
    this.initGpu();
  }

  initGpu() {
    this.uuid = MathUtils.generateUUID();
    if (this.gl) {
      this.isWebGL2 = true;
      if (!this.extension) {
        this.extension = this.gl.getExtension(
          "EXT_disjoint_timer_query_webgl2",
        );
      }
      if (this.extension === null) {
        this.isWebGL2 = false;
      }
    }
  }

  /**
   * FPS số thực trên cửa sổ 1 giây (frameCount * 1000 / elapsed).
   * Trả số lẻ (vd 120.3) thay vì đếm nguyên -> không nhảy +/-1.
   */
  protected calculateFps(): number {
    const currentTime = this.now();
    const cutoff = currentTime - 1000;

    this.frameTimes.push(currentTime);

    while (
      this.frameTimesHead < this.frameTimes.length &&
      this.frameTimes[this.frameTimesHead] <= cutoff
    ) {
      this.frameTimesHead++;
    }

    // Compact để giới hạn bộ nhớ
    if (this.frameTimesHead > 128) {
      this.frameTimes = this.frameTimes.slice(this.frameTimesHead);
      this.frameTimesHead = 0;
    }

    const count = this.frameTimes.length - this.frameTimesHead;
    if (count < 2) return count;

    // elapsed = khoảng thời gian giữa mẫu cũ nhất và mới nhất trong cửa sổ
    const oldest = this.frameTimes[this.frameTimesHead];
    const elapsed = currentTime - oldest;
    if (elapsed <= 0) return count;

    // (count - 1) khoảng cách trong elapsed ms
    return ((count - 1) * 1000) / elapsed;
  }

  /**
   * Increase frameID
   * @param { any | undefined } now
   */
  nextFrame(now: any) {
    this.frameId++;
    const t = now || this.now();
    const duration = t - this.paramTime;

    const rawFps = this.calculateFps();
    // EMA: làm mượt FPS hiển thị (giống cảm giác ổn định của stats-gl).
    this.smoothFps =
      this.smoothFps === 0 ? rawFps : this.smoothFps + 0.1 * (rawFps - this.smoothFps);
    const fps = this.smoothFps;
    const gpu = this.totalGpuDuration;
    const cpu = this.totalCpuDuration;

    // params
    if (this.frameId <= 1) {
      this.paramFrame = this.frameId;
      this.paramTime = t;
    } else {
      if (t >= this.paramTime) {
        this.maxMemory = window.performance.memory
          ? window.performance.memory.jsHeapSizeLimit / 1048576
          : 0;
        const frameCount = this.frameId - this.paramFrame;

        this.currentMem = Math.round(
          window.performance && window.performance.memory
            ? window.performance.memory.usedJSHeapSize / 1048576
            : 0,
        );

        this.currentCpu = cpu;

        this.logsAccums.mem.push(this.currentMem);
        this.logsAccums.fps.push(fps);
        this.logsAccums.gpu.push(gpu);
        this.logsAccums.cpu.push(cpu);

        if (t >= this.paramTime + 1000 / this.logsPerSecond) {
          this.paramLogger({
            cpu: average(this.logsAccums.cpu),
            gpu: average(this.logsAccums.gpu),
            mem: average(this.logsAccums.mem),
            fps: average(this.logsAccums.fps),
            duration: Math.round(duration),
            maxMemory: this.maxMemory,
            frameCount,
          });

          this.logsAccums.mem = [];
          this.logsAccums.fps = [];
          this.logsAccums.gpu = [];
          this.logsAccums.cpu = [];

          this.paramFrame = this.frameId;
          this.paramTime = t;
        }
      }
    }

    // reset CPU tích lũy cho frame kế tiếp
    this.totalCpuDuration = 0;

    // chart
    if (!this.chartFrame) {
      this.chartFrame = this.frameId;
      this.chartTime = t;
      this.circularId = 0;
    } else {
      const timespan = t - this.chartTime;
      let hz = (this.chartHz * timespan) / 1e3;
      while (--hz > 0) {
        this.fpsChart[this.circularId % this.chartLen] = fps;

        const memS = 1000 / this.currentMem;
        const cpuS = cpu;
        const gpuS = gpu;
        if (gpuS > 0) {
          this.gpuChart[this.circularId % this.chartLen] = gpuS;
        }
        if (cpuS > 0) {
          this.cpuChart[this.circularId % this.chartLen] = cpuS;
        }
        if (memS > 0) {
          this.memChart[this.circularId % this.chartLen] = memS;
        }
        for (let i = 0; i < this.names.length; i++) {
          this.chartLogger({
            i,
            data: {
              fps: this.fpsChart,
              gpu: this.gpuChart,
              cpu: this.cpuChart,
              mem: this.memChart,
            },
            circularId: this.circularId,
          });
        }
        this.circularId++;
        this.chartFrame = this.frameId;
        this.chartTime = t;
      }
    }
  }

  /**
   * statgl GPU: đọc các query đã có kết quả từ hàng đợi, trả ms thật.
   */
  protected processGpuQueries() {
    const gl = this.gl;
    const ext = this.extension;
    if (!gl || !ext) return;

    this.totalGpuDuration = 0;

    for (let i = this.gpuQueries.length - 1; i >= 0; i--) {
      const queryInfo = this.gpuQueries[i];
      const available = gl.getQueryParameter(
        queryInfo.query,
        gl.QUERY_RESULT_AVAILABLE,
      );
      const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);

      if (available && !disjoint) {
        const elapsed = gl.getQueryParameter(queryInfo.query, gl.QUERY_RESULT);
        // nanoseconds -> milliseconds
        this.totalGpuDuration += elapsed * 1e-6;
        gl.deleteQuery(queryInfo.query);
        this.gpuQueries.splice(i, 1);
      }
    }
  }

  startGpu() {
    const gl = this.gl;
    const ext = this.extension;
    if (!gl || !ext || !this.isWebGL2) return;

    // đọc kết quả của các query đã hoàn tất trước khi mở query mới
    this.processGpuQueries();

    if (this.activeQuery) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
    }

    this.activeQuery = gl.createQuery();
    if (this.activeQuery) {
      gl.beginQuery(ext.TIME_ELAPSED_EXT, this.activeQuery);
    }
  }

  endGpu() {
    const gl = this.gl;
    const ext = this.extension;
    if (!gl || !ext || !this.isWebGL2) return;

    if (this.activeQuery) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      this.gpuQueries.push({ query: this.activeQuery });
      this.activeQuery = null;
    }
  }

  /**
   * statgl CPU: bắt đầu đo wall-clock của phần render.
   */
  protected beginProfiling() {
    this.cpuStartTime = this.now();
  }

  /**
   * statgl CPU: cộng dồn thời gian wall-clock vào totalCpuDuration.
   */
  protected endProfiling() {
    this.totalCpuDuration += this.now() - this.cpuStartTime;
  }

  /**
   * Begin named measurement
   * @param { string | undefined } name
   */
  begin(_name: string) {
    this.beginProfiling();
    this.startGpu();
  }

  /**
   * End named measure
   * @param { string | undefined } name
   */
  end(_name: string) {
    this.endGpu();
    this.endProfiling();
  }

  dispose() {
    const gl = this.gl;
    const ext = this.extension;
    try {
      if (this.isWebGL2 && gl && ext && this.activeQuery) {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
        gl.deleteQuery(this.activeQuery);
        this.activeQuery = null;
      }
    } catch {}

    if (gl) {
      for (const queryInfo of this.gpuQueries) {
        try {
          gl.deleteQuery(queryInfo.query);
        } catch {}
      }
    }
    this.gpuQueries.length = 0;
    this.frameTimes.length = 0;
    this.frameTimesHead = 0;
    this.smoothFps = 0;
    this.totalCpuDuration = 0;
    this.totalGpuDuration = 0;
  }
}
