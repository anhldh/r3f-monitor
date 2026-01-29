# R3F-Performance

**[Changelog](https://github.com/anhldh/r3f-performace/blob/main/CHANGELOG.md)**

A easily tool to monitor the performance of your  
[@react-three/fiber](https://github.com/pmndrs/react-three-fiber) application.

<table>
  <tr>
    <td>Add the <code>&lt;PerfMonitor /&gt;</code> component anywhere in your R3F Canvas.</td>
    <td>
<a href="https://codesandbox.io/p/sandbox/3sqpy4">
  <img src="https://bf3xu0otcy.ufs.sh/f/lSBP1EY5xRSnLHNlxKuvoRAdugXS39mBlIzpHEcwjKqeLFNJ" /></td>
</a>
  </tr>
</table>

**[View Example](https://codesandbox.io/p/sandbox/3sqpy4)**

## Features

- FPS and render performance monitoring
- Draw calls, geometries and WebGL program analysis
- Memory usage tracking
- Estimated GPU VRAM usage
- Optional performance graphs
- Minimal / headless modes for production or debugging

## Installation

```bash
# npm
npm install r3f-performance

# yarn
yarn add r3f-performance

# pnpm
pnpm add r3f-performance
```

## Options

```jsx
logsPerSecond?: 10, // Refresh rate of the logs

antialias?: true, // Take a bit more performances but render the text with antialiasing

overClock?: false, // Disable the limitation of the monitor refresh rate for the fps

deepAnalyze?: false, // More detailed informations about gl programs

showGraph?: Toggles the visibility of the performance graphs. Default true

graphType?: Style of the graph. Options: 'line' or 'bar'.

minimal?: false // condensed version with the most important informations (gpu/memory/fps/memory/vram)

matrixUpdate?: false // count the number of time matrixWorldUpdate is called per frame

chart?: {
  hz: 60, // graphs refresh frequency parameter
  length: 120, // number of values shown on the monitor
}

className?: '' // override CSS class

style?: {} // override style

position?: Sets the position of the panel. Options: 'top-right', 'top-left', 'bottom-right', 'bottom-left'.

```

## Usage

**[View Example](https://codesandbox.io/p/sandbox/3sqpy4)**

```jsx
import { Canvas } from "@react-three/fiber";
import { PerfMonitor } from "r3f-performance";

function App() {
  return (
    <Canvas>
      <PerfMonitor />
    </Canvas>
  );
}
```

### Maintainers :

- [`@anhldh`](https://github.com/anhldh/r3f-performance)

### Thanks

Special thanks to [`twitter @utsuboco`](https://twitter.com/utsuboco). This library is a port/fork based on the original r3f-perf.
