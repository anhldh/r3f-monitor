[![npm](https://img.shields.io/npm/v/r3f-monitor?style=flat-square)](https://www.npmjs.com/package/r3f-monitor)

# R3F-Monitor

**[Docs & live examples](https://anhldh.github.io/r3f-monitor)** · **[Changelog](https://github.com/anhldh/r3f-monitor/blob/main/CHANGELOG.md)**

An advanced, easy-to-use performance monitoring tool for [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) applications.

Add the <code>&lt;PerfMonitor /&gt;</code> component anywhere in your R3F Canvas — or go **headless** and bring your own UI.

> **New in v3 — WebGPU.** Works with three's `WebGPURenderer` as well as the classic `WebGLRenderer`. The renderer is detected at runtime, so there is nothing to configure and **existing WebGL projects need no changes.**
>
> **v3.1** — `deepAnalyze` now works on WebGPU too (per-material breakdown + per-pass timing), and the monitor works with `frameloop="demand"`.

## Display Modes

### 🗂 Tab Display (Default)

A modern, structured interface with separated tabs for better focus and deep inspection.

<table>
  <tr>
    <td width="220"><strong>Tab Display</strong><br/><br/>
      Modern tab-based layout.<br/>
      Best for deep performance debugging.
    </td>
    <td>
      <img src="https://bf3xu0otcy.ufs.sh/f/lSBP1EY5xRSn0ZYS1Dbpsg4MZrJQDzVO5Iy3AFX186WBd2T9" />
    </td>
  </tr>
</table>

---

### 📊 Classic Display

A compact, always-visible performance panel inspired by traditional FPS monitors.

<table>
  <tr>
    <td width="220"><strong>Classic Display</strong><br/><br/>
      Compact single-panel layout.<br/>
      Fast visual performance overview.
    </td>
    <td>
      <img src="https://bf3xu0otcy.ufs.sh/f/lSBP1EY5xRSnLHNlxKuvoRAdugXS39mBlIzpHEcwjKqeLFNJ" />
    </td>
  </tr>
</table>

## 🧪 Example

Live example:  
👉 https://codesandbox.io/p/sandbox/3sqpy4

## 🚀 Key Features

- **WebGPU + WebGL (v3):** One component for both. The measurement path is chosen from the renderer at runtime — including `WebGPURenderer`'s own WebGL 2 fallback. Adds a **GPU compute** metric and **exact** (rather than estimated) VRAM on WebGPU.
- **Comprehensive Metrics:** Monitor FPS, CPU/GPU render times, and JS Heap Memory.
- **Accurate Measurement Engine (v2):** FPS via a real 1-second sliding window, CPU via `performance.now()` accumulation, and GPU via a WebGL2 timer-query queue (`EXT_disjoint_timer_query_webgl2`) reporting true milliseconds.
- **Headless Mode (v2.1):** Run the measurement engine without the built-in UI. Read live metrics with `usePerfData()`.
- **Adaptive Quality (v2.2):** `<PerfAdaptive />` automatically raises/lowers a quality `factor` (0–1) based on sustained FPS — drei `<PerformanceMonitor>`-compatible API, plus real GPU/CPU times to tell GPU-bound from CPU-bound. Pair with `useGpuTier()` for a per-device starting quality.
- **VRAM:** Breakdown of GPU memory (Textures and Geometries) — estimated from the scene on WebGL, measured in real bytes on WebGPU.
- **Deep Analysis:** Find the expensive material — per-program (WebGL) or per-material (WebGPU) breakdown with triangle share, textures, hide / wireframe toggles, and matrix-update counting. On WebGPU (three r181+) it also times every render / compute pass. See [Deep Analysis](#-deep-analysis).
- **Flexible UI:** Choose between graphical visualizations, detailed lists, or a minimal condensed view.

> **Note:** Overclock mode was **removed in v2**. It still exists in `1.2.0` and earlier — pin to `1.2.0` if you rely on it.

---

## 📦 Installation

```bash
# npm
npm install r3f-monitor

# yarn
yarn add r3f-monitor

# pnpm
pnpm add r3f-monitor

# bun
bun i r3f-monitor

```

## ⚙️ Options

```ts
logsPerSecond?: number          // Log refresh rate (default: 10)

antialias?: boolean             // Enable text antialiasing

deepAnalyze?: boolean           // Per-material breakdown (+ per-pass timing on WebGPU)

showGraph?: boolean             // Toggle performance graphs (default: true)

graphType?: "line" | "bar"      // Graph style (default: "bar")

minimal?: boolean               // Compact condensed view

matrixUpdate?: boolean          // Count matrixWorld updates per frame

chart?: {
  hz?: number                   // Graph refresh frequency (default: 60)
  length?: number               // Number of data points displayed (default: 120)
}

className?: string              // Custom CSS class

style?: React.CSSProperties     // Inline style override

position?:
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"               // Default: "top-right"

displayType?: "tab" | "classic" // Default: "tab"
```

## 📐 Measurement Engine

Starting with **v2**, the FPS / CPU / GPU values come from a reworked measurement core:

- **FPS** — counted over a real 1-second sliding window and reported as a continuous value, so the readout stays stable instead of flickering ±1. Time the loop spends idle (on-demand pauses, hidden tab) is left out of the window. The line graph also dips on single frames that clearly stall (over 2× the current frame time).
- **CPU** — wall-clock time of the render phase, accumulated per frame via `performance.now()`.
- **GPU** — GPU time for the render pass, in **true milliseconds** (no scaling fudge). The mechanism depends on the renderer: a WebGL2 timer-query queue (`EXT_disjoint_timer_query_webgl2`) on `WebGLRenderer`, three's timestamp queries on `WebGPURenderer`. Both are read back asynchronously, so the value trails the current frame by a frame or two.

The bar graph (`graphType: "bar"`) scrolls left as new samples arrive and uses a fixed (high-water) vertical scale, with a gradient fill per metric.

**`frameloop="demand"`** (v3.1) — only frames R3F actually renders are measured, including single frames requested one at a time with `invalidate()`. While the scene is idle nothing is sampled: the readouts and `usePerfData` hold their last values and the graphs stop moving. Sampling picks up again on the next frame; the bar graph simply carries on, while the line graph fills the idle gap with the first new reading (up to the whole chart after a long pause). Idle time doesn't count as slow frames, so resuming reads the FPS the scene actually renders at. The flip side: a freeze that happens while no frame is pending can't be told apart from idle and doesn't show as a dip (time spent inside a frame still shows as CPU). The monitor never keeps an on-demand canvas awake by itself — the only extra frames are a few rendered right after `deepAnalyze` is switched on, so its list fills while the scene is idle.

---

## ⚡ WebGPU

> Added in **v3**

Mount `<PerfMonitor />` (or `<PerfHeadless />`) exactly as you always have — the
renderer is detected at runtime:

```tsx
import { Canvas } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";
import { PerfMonitor } from "r3f-monitor";

<Canvas
  gl={async (props) => {
    const renderer = new WebGPURenderer({
      canvas: props.canvas as HTMLCanvasElement,
      antialias: props.antialias,
    });
    await renderer.init();
    return renderer;
  }}
>
  <PerfMonitor />
  {/* <YourScene /> */}
</Canvas>;
```

`WebGPURenderer` falls back to its own WebGL 2 backend when `navigator.gpu` is
missing. That is still the WebGPU measurement path — `infos.backend` reports the
renderer class (`"webgpu"`), `infos.api` reports the GPU API actually in use
(`"webgpu"` or `"webgl2"`).

### What differs

| Metric | `WebGLRenderer` | `WebGPURenderer` |
| --- | --- | --- |
| **VRAM** | **estimated** — walks the scene and sums buffer sizes, guessing texture memory from dimensions | **measured** — three tracks real allocated bytes, including render targets and uniform buffers |
| **COMPUTE** | — | ms spent in compute passes, plus a **DISPATCH** count |
| **Shaders** | an enumerable list of programs | a count only — node materials compile straight to WGSL pipelines |
| **`deepAnalyze`** | grouped per program | grouped per material, plus per-pass timing (three r181+) |

Because the two renderers measure *different things*, the VRAM figures will not
match for the same scene. `usePerfData().vramSource` tells you which you are
looking at.

The **COMPUTE** row only appears once the scene actually dispatches compute — an
ordinary scene never does, so it stays hidden. `GPU` covers the render pass
only: **total GPU time is `GPU + COMPUTE`.**

**`deepAnalyze` works on both** since v3.1 — see [Deep Analysis](#-deep-analysis).

GPU timing needs three's timestamp queries, which r3f-monitor turns on itself —
you do **not** need to pass `trackTimestamp` when creating the renderer.

---

## 🔬 Deep Analysis

> Available on WebGPU since **v3.1**

Turn it on while profiling, keep it off in production:

```tsx
<PerfMonitor deepAnalyze />
```

or flip it on from the monitor's settings. Then open the **code icon** in the tab UI.
Each entry shows the meshes using that material, their share of the frame's
triangles / lines / points, texture slots and — on WebGL — the program's live
uniforms. **Hover** the eye to see those meshes in wireframe, **click** it to hide
them: the quickest way to find the material that tanks a frame.

| | `WebGLRenderer` | `WebGPURenderer` |
| --- | --- | --- |
| Grouped by | WebGL program (mapped back to its material) | material |
| Uniforms | live program uniforms | texture slots read off the material |
| **Passes** | — | every render / compute pass of a frame, CPU + GPU ms |

**Passes** (WebGPU only) lists the main scene, shadow maps, render targets,
post-processing and compute passes separately — something a single GPU number
can't tell you. It is built on `renderer.inspector`:

| three | Material list | Passes CPU | Passes GPU |
| --- | --- | --- | --- |
| < r181 | ✓ | — | — |
| r181+ | ✓ | ✓ | ✓ (needs `timestamp-query`; arrives a few frames late) |

The existing inspector is wrapped, not replaced, so three's own Inspector addon
keeps working alongside. If analysis ever throws, it switches itself off with one
console warning — the regular metrics keep running.

---

## 🎛 Bring your own UI (Headless)

> Added in **v2.1**

The default `<PerfMonitor />` ships a ready-made UI. If you want to design your own
interface — or adjust quality based on FPS — use **headless mode**:
`<PerfHeadless />` handles the measurement, you do the rest.

There are exactly two things you need:

1. **Read the values to display** → `usePerfData()`
2. **Change quality based on FPS** → `<PerfAdaptive />` (see [Adaptive Quality](#-adaptive-quality))

The one rule: place `<PerfHeadless />` somewhere **inside `<Canvas>`**.

### 1) Read the values — `usePerfData()`

A single hook, updating at `logsPerSecond` (default ~10×/sec, not every frame). The
component reading the data can live **outside** `<Canvas>` — it only reads the store,
no `useThree` required.

Call with no args → returns **all** the metrics:

```ts
const {
  fps,
  cpu,
  gpu,
  gpuCompute,
  mem,
  vram, // the "hot" numbers
  vramSource, // "measured" | "estimated"
  gl, // { calls, triangles, points, lines, geometries, textures, programs, computeCalls }
  infos, // { version, renderer, vendor, backend, api }
} = usePerfData();
```

| Field        | Unit     | Meaning                                                      |
| ------------ | -------- | ------------------------------------------------------------ |
| `fps`        | frames/s | frames per second                                            |
| `cpu`        | ms       | CPU time per frame                                           |
| `gpu`        | ms       | GPU time per frame, **render pass only**                     |
| `gpuCompute` | ms       | GPU time in compute passes — WebGPU only, `0` on WebGL        |
| `mem`        | MB       | JS heap in use                                               |
| `vram`       | MB       | GPU memory — see `vramSource`                                 |
| `vramSource` | —        | `"measured"` (WebGPU, real bytes) or `"estimated"` (WebGL)    |
| `gl`         | —        | render stats for the latest frame                            |
| `infos`      | —        | renderer/vendor/`backend`/`api` (constant for the session)    |

Or pass a **selector** to read only the field you need — the component only
re-renders when that field changes (avoids wasted re-renders when displaying a
single number):

```tsx
const fps = usePerfData((d) => d.fps);
```

```tsx
import { Canvas } from "@react-three/fiber";
import { PerfHeadless, usePerfData } from "r3f-monitor";

// Custom UI — place OUTSIDE <Canvas>
function MyHud() {
  const { fps, cpu, gpu, mem, vram, gl } = usePerfData();
  return (
    <div
      style={{ position: "fixed", top: 12, left: 12, font: "12px monospace" }}
    >
      <div>{fps.toFixed(0)} FPS</div>
      <div>
        CPU {cpu.toFixed(1)} ms · GPU {gpu.toFixed(1)} ms
      </div>
      <div>
        RAM {mem.toFixed(0)} MB · VRAM {vram.toFixed(1)} MB
      </div>
      <div>
        {gl.calls} calls · {gl.triangles} tris
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Canvas>
        <PerfHeadless logsPerSecond={10} />
        {/* <YourScene /> */}
      </Canvas>
      <MyHud />
    </>
  );
}
```

---

## 🎚 Adaptive Quality

> Added in **v2.2**

`<PerfAdaptive />` watches the sustained FPS coming from the measurement engine and
maintains a quality **factor between 0 and 1**. When the device comfortably exceeds
the upper FPS bound the factor steps up (_incline_); when it stays under the lower
bound it steps down (_decline_). You map the factor to whatever costs performance:
`dpr`, shadow map size, post-processing, draw distance…

The API mirrors drei's `<PerformanceMonitor>`, so existing code ports 1:1.

The one rule: mount a measuring component — `<PerfHeadless />` or `<PerfMonitor />` —
inside `<Canvas>`. `<PerfAdaptive />` itself renders nothing and only listens
(1 FPS sample per engine log tick, ~10/s by default).

```tsx
import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { PerfHeadless, PerfAdaptive } from "r3f-monitor";

export default function App() {
  const [dpr, setDpr] = useState(1);
  return (
    <Canvas dpr={dpr}>
      <PerfHeadless />
      <PerfAdaptive onChange={(e) => setDpr(0.5 + e.factor * 1.5)} />
      {/* <YourScene /> */}
    </Canvas>
  );
}
```

### Options

| Prop         | Default                                     | Meaning                                                      |
| ------------ | ------------------------------------------- | ------------------------------------------------------------ |
| `iterations` | `10`                                        | Samples collected before each decision                       |
| `threshold`  | `0.75`                                      | Fraction of samples that must cross a bound to trigger       |
| `step`       | `0.1`                                       | Amount added/subtracted from `factor`                        |
| `factor`     | `0.5`                                       | Starting factor                                              |
| `flipflops`  | `Infinity`                                  | Max incline/decline flips before `onFallback` fires          |
| `bounds`     | `(hz) => (hz > 100 ? [60, 100] : [40, 60])` | `[lower, upper]` FPS bounds, given the observed refresh rate |

The refresh rate is auto-detected from the rAF cadence at mount and refined by the
highest FPS seen during the session — no configuration needed.

### Callbacks

Every callback receives the engine: `{ fps, factor, refreshrate, gpu, cpu, fallback, … }`.

- `onIncline(e)` — sustained FPS above the upper bound: the device has headroom.
- `onDecline(e)` — sustained FPS below the lower bound: reduce quality.
- `onChange(e)` — the factor changed, in either direction.
- `onFallback(e)` — flipped more than `flipflops` times: performance is unstable, set a fixed low baseline.

**GPU-bound or CPU-bound?** Each sample carries the real render times (ms), so you
can pull the _right_ lever:

```tsx
<PerfAdaptive
  onDecline={(e) => {
    if (e.gpu > e.cpu)
      lowerResolution(); // GPU-bound → dpr/effects help
    else reduceDrawCalls(); // CPU-bound → dpr won't help
  }}
/>
```

### Hook

Children of `<PerfAdaptive>` can subscribe with `usePerfAdaptive` — the equivalent
of drei's `usePerformanceMonitor`:

```tsx
usePerfAdaptive({ onChange: (e) => setQuality(e.factor) });
```

The decision core is also exported as a plain class, `AdaptiveEngine`
(`addSample(fps, gpu?, cpu?)`), if you want to feed it samples yourself.

### Starting quality — `useGpuTier()`

Runtime adaptation only reacts _after_ the first slow frames. To start at a
sensible quality per device, use `useGpuTier()` — a suspending wrapper around
[`@pmndrs/detect-gpu`](https://github.com/pmndrs/detect-gpu):

```tsx
import { Suspense } from "react";
import { useGpuTier } from "r3f-monitor";

function Effects() {
  const { tier } = useGpuTier(); // 0 (weakest) … 3 (strongest)
  return tier >= 2 ? <FancyPostProcessing /> : null;
}

// <Suspense fallback={null}><Effects /></Suspense>
```

`useDetectGPU` is exported as a drei-compatible alias, and `<GpuTier>` offers a
render-prop version. The component calling the hook must be under `<Suspense>`.

### One engine, no conflicts

Since **v2.2** the measurement core is a ref-counted singleton: mounting
`<PerfHeadless />` and `<PerfMonitor />` at the same time — or toggling the UI
on and off — always runs exactly **one** engine.

A common setup is `<PerfHeadless />` feeding your own HUD plus `<PerfMonitor />`
mounted only while debugging. How their options combine (v3.1):

- **`deepAnalyze`, `matrixUpdate`** — on if **any** mounted instance enables them,
  applied live (including the toggles in the monitor's settings).
- **`logsPerSecond`, `chart`** — taken from the first mounted instance; a console
  warning is logged only if a later one actually differs.

---

## Usage

**[View Example](https://codesandbox.io/p/sandbox/3sqpy4)**

```jsx
import { Canvas } from "@react-three/fiber";
import { PerfMonitor } from "r3f-monitor";

function App() {
  return (
    <Canvas>
      <PerfMonitor />
    </Canvas>
  );
}
```

### Maintainers :

- [`@anhldh`](https://github.com/anhldh) · [anhldh.com](https://anhldh.com)

### Thanks

r3f-monitor was originally built on code from [r3f-perf](https://github.com/utsuboco/r3f-perf) by [@utsuboco](https://github.com/utsuboco) — thank you for the foundation. It has since been largely reworked: new measurement core, headless mode, adaptive quality and WebGPU support.
