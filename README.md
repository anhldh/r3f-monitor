[![npm](https://img.shields.io/npm/v/r3f-monitor?style=flat-square)](https://www.npmjs.com/package/r3f-monitor)

# R3F-Monitor

**[Changelog](https://github.com/anhldh/r3f-monitor/blob/main/CHANGELOG.md)**

An advanced, easy-to-use performance monitoring tool for [@react-three/fiber](https://github.com/pmndrs/react-three-fiber) applications.

Add the <code>&lt;PerfMonitor /&gt;</code> component anywhere in your R3F Canvas.

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
- **VRAM Estimation:** Get an estimated breakdown of your GPU memory usage (Textures and Geometries).
- **Deep Analysis:** Inspect individual WebGL programs, toggle visibility, and track matrix updates.
- **Overclock Mode:** Bypass V-Sync limitations to benchmark true hardware rendering capabilities.
- **Flexible UI:** Choose between graphical visualizations, detailed lists, or a minimal condensed view.

---

## 📦 Installation

```bash
# npm
npm install r3f-monitor

# yarn
yarn add r3f-monitor

# pnpm
pnpm add r3f-monitor

```

## ⚙️ Options

```ts
logsPerSecond?: number          // Log refresh rate (default: 10)

antialias?: boolean             // Enable text antialiasing

overClock?: boolean             // Disable FPS refresh limit

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
