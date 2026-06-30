[![npm](https://img.shields.io/npm/v/r3f-monitor?style=flat-square)](https://www.npmjs.com/package/r3f-monitor)

# R3F-Monitor

**[Changelog](https://github.com/anhldh/r3f-monitor/blob/main/CHANGELOG.md)**

An advanced, easy-to-use performance monitoring tool for [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) applications.

Add the <code>&lt;PerfMonitor /&gt;</code> component anywhere in your R3F Canvas — or go **headless** and bring your own UI.

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

- **Comprehensive Metrics:** Monitor FPS, CPU/GPU render times, and JS Heap Memory.
- **Accurate Measurement Engine (v2):** FPS via a real 1-second sliding window, CPU via `performance.now()` accumulation, and GPU via a WebGL2 timer-query queue (`EXT_disjoint_timer_query_webgl2`) reporting true milliseconds.
- **Headless Mode (v2.1):** Run the measurement engine without the built-in UI. Read live metrics with `usePerfData()` and drive adaptive quality with `fpsTiers`.
- **VRAM Estimation:** Get an estimated breakdown of your GPU memory usage (Textures and Geometries).
- **Deep Analysis:** Inspect individual WebGL programs, toggle visibility, and track matrix updates.
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

deepAnalyze?: boolean           // Enable detailed WebGL program inspection

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

- **FPS** — counted over a real 1-second sliding window and reported as a continuous value (smoothed with a light EMA), so the readout stays stable instead of flickering ±1.
- **CPU** — wall-clock time of the render phase, accumulated per frame via `performance.now()`.
- **GPU** — measured with a WebGL2 timer-query queue (`EXT_disjoint_timer_query_webgl2`). Results are reported in **true milliseconds** (no scaling fudge). WebGL2 only.

The bar graph (`graphType: "bar"`) scrolls left as new samples arrive and uses a fixed (high-water) vertical scale, with a gradient fill per metric.

---

## 🎛 Bring your own UI (Headless)

> Added in **v2.1**

The default `<PerfMonitor />` ships a ready-made UI. If you want to design your own
interface — or adjust quality based on FPS — use **headless mode**:
`<PerfHeadless />` handles the measurement, you do the rest.

There are exactly two things you need:

1. **Read the values to display** → `usePerfData()`
2. **Change quality based on FPS** (adaptive) → `fpsTiers` + `onTierChange` on `<PerfHeadless />`

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
  mem,
  vram, // the "hot" numbers
  gl, // { calls, triangles, points, lines, geometries, textures, programs }
  infos, // { version, renderer, vendor }
} = usePerfData();
```

| Field   | Unit     | Meaning                                    |
| ------- | -------- | ------------------------------------------ |
| `fps`   | frames/s | frames per second                          |
| `cpu`   | ms       | CPU time per frame                         |
| `gpu`   | ms       | GPU time per frame (WebGL2)                |
| `mem`   | MB       | JS heap in use                             |
| `vram`  | MB       | estimated VRAM from the scene              |
| `gl`    | —        | render stats for the latest frame          |
| `infos` | —        | renderer/vendor (constant for the session) |

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

- [`@anhldh`](https://github.com/anhldh/r3f-monitor)

### Thanks

Special thanks to [`twitter @utsuboco`](https://twitter.com/utsuboco). This library is a port/fork based on the original [r3f-perf](https://github.com/utsuboco/r3f-perf) library.
