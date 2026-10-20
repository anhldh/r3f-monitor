import { Canvas } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerfHeadless } from "../../src/components/PerfHeadless";
import { PerfMonitor } from "../../src/components/PerfMonitor";
import { usePerfData } from "../../src/hooks/usePerfData";
import { CameraControls, DemandOrbit } from "./CameraControls";
import { ComputeParticles } from "./ComputeParticles";
import { DemoScene } from "./DemoScene";
import { PrimitiveScene } from "./PrimitiveScene";
import { WebGpuCanvas } from "./WebGpuCanvas";

type Mode = "webgl" | "webgpu" | "demand";

const CAMERA = {
  position: [0, 1.4, 7.6] as [number, number, number],
  fov: 48,
};

/** App-side HUD fed by <PerfHeadless /> — the "reading data" half of the setup. */
function AppHud() {
  const fps = usePerfData((data) => data.fps);
  const cpu = usePerfData((data) => data.cpu);
  const calls = usePerfData((data) => data.gl.calls);
  const programs = usePerfData((data) => data.gl.programs);

  const cards = [
    { label: "FPS", value: fps > 0 ? fps.toFixed(0) : "-" },
    { label: "CPU", value: cpu.toFixed(2), unit: "ms" },
    { label: "Draw calls", value: String(calls) },
    { label: "Programs", value: String(programs) },
  ];

  return (
    <aside className="metrics-hud" aria-label="App HUD from PerfHeadless">
      {cards.map((card) => (
        <div key={card.label} className="metric-card">
          <span className="metric-label">{card.label}</span>
          <span className="metric-value">
            {card.value}
            {card.unit && <small>{card.unit}</small>}
          </span>
        </div>
      ))}
    </aside>
  );
}

const CAPTIONS: Record<Mode, { title: string; body: string }> = {
  webgl: {
    title: "Per-program breakdown (WebGL)",
    body: "Click the code icon in the monitor. Each entry maps a WebGL program to its material: users, triangles, textures, uniforms. Hover the eye for wireframe, click it to hide the meshes.",
  },
  webgpu: {
    title: "Per-material breakdown + passes (WebGPU)",
    body: "Same panel on WebGPURenderer, grouped by material. The Passes block lists every render/compute pass of a frame with CPU and GPU time (three r181+).",
  },
  demand: {
    title: 'frameloop="demand" + two instances',
    body: "PerfHeadless feeds the HUD, PerfMonitor is the debug panel with deepAnalyze on. The list fills without moving the camera, and hide/wireframe apply immediately.",
  },
};

function DeepAnalyzeDemo({ mode = "webgl" }: { mode?: Mode }) {
  const caption = CAPTIONS[mode];
  const monitor = (
    <PerfMonitor displayType="tab" position="top-right" deepAnalyze />
  );

  return (
    <main className="demo-shell">
      {mode === "webgpu" && (
        <WebGpuCanvas className="demo-canvas" camera={CAMERA} dpr={[1, 2]}>
          {monitor}
          <PrimitiveScene count={24} />
          <ComputeParticles count={50_000} size={0.05} />
          <CameraControls />
        </WebGpuCanvas>
      )}

      {mode === "webgl" && (
        <Canvas className="demo-canvas" camera={CAMERA} dpr={[1, 2]}>
          {monitor}
          <DemoScene />
          <CameraControls />
        </Canvas>
      )}

      {mode === "demand" && (
        <>
          <Canvas
            className="demo-canvas"
            frameloop="demand"
            camera={CAMERA}
            dpr={[1, 2]}
          >
            <PerfHeadless logsPerSecond={10} />
            {monitor}
            <DemoScene />
            <DemandOrbit />
          </Canvas>
          <AppHud />
        </>
      )}

      <div className="demo-caption">
        <strong>{caption.title}</strong>
        <span>{caption.body}</span>
      </div>
    </main>
  );
}

const meta = {
  title: "Guides/Deep Analyze",
  component: DeepAnalyzeDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: [
          "`deepAnalyze` breaks the frame down by material so you can find **what** is expensive, not just **that** the frame is. It is a debugging tool: turn it on while profiling, keep it off in production.",
          "",
          "Enable it with `<PerfMonitor deepAnalyze />` (or the toggle in the monitor's settings), then open the **code icon** in the tab UI.",
          "",
          "### What each entry shows",
          "",
          "- **Users** — meshes sharing the material, with geometry type, triangle count and size.",
          "- **Share of the frame** — triangles/lines/points as a % of everything drawn.",
          "- **Textures / uniforms** — texture slots with preview; on WebGL, the program's live uniforms.",
          "- **Eye button** — hover for wireframe, click to hide those meshes. Great for finding the material that tanks a frame.",
          "",
          "### WebGL vs WebGPU",
          "",
          "| | WebGLRenderer | WebGPURenderer |",
          "| --- | --- | --- |",
          "| Grouped by | WebGL program (mapped back to its material) | material — node materials compile to WGSL pipelines with no program list |",
          "| Uniforms | live program uniforms | texture slots read off the material |",
          "| **Passes** (per render/compute pass CPU + GPU ms) | — | three **r181+**, via `renderer.inspector` |",
          "",
          "On WebGPU with three older than r181 the material list still works; only the Passes block is hidden. The inspector is wrapped, not replaced, so three's own Inspector addon keeps working alongside.",
          "",
          "### Good to know",
          "",
          "- **Multiple instances.** `deepAnalyze` is on if *any* mounted instance enables it — e.g. `<PerfHeadless />` for your HUD plus `<PerfMonitor deepAnalyze />` for debugging. `logsPerSecond` / `chart` still come from the first instance.",
          "- **`frameloop=\"demand\"`.** Enabling it renders a few extra frames so the list fills while the scene is idle, and panel actions (hide / wireframe) request a frame themselves.",
          "- **Isolated failures.** If analysis throws, it switches itself off with one console warning; FPS/CPU/GPU keep measuring.",
        ].join("\n"),
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
  argTypes: {
    mode: { table: { disable: true } },
  },
} satisfies Meta<typeof DeepAnalyzeDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WebGL: Story = {
  name: "WebGL",
  args: { mode: "webgl" },
  parameters: {
    docs: {
      description: {
        story:
          "Default `WebGLRenderer`. Programs are mapped back to materials through a define injected into each shader, so the first frame only prepares the list and the second one fills it.",
      },
      source: {
        language: "tsx",
        code: `<Canvas>
  <PerfMonitor deepAnalyze />
  <YourScene />
</Canvas>`,
      },
    },
  },
};

export const WebGPU: Story = {
  name: "WebGPU",
  args: { mode: "webgpu" },
  parameters: {
    docs: {
      description: {
        story:
          "`WebGPURenderer` with a TSL compute particle field, so the **Passes** block shows both a render pass and a compute pass. GPU times arrive a few frames late (timestamp queries resolve asynchronously) and need `timestamp-query` support; without it the passes show CPU time only.",
      },
      source: {
        language: "tsx",
        code: `import { WebGPURenderer } from "three/webgpu";

<Canvas
  gl={async (props) => {
    const renderer = new WebGPURenderer({ canvas: props.canvas as HTMLCanvasElement });
    await renderer.init();
    return renderer;
  }}
>
  {/* Same prop — per-material list on any three, Passes on r181+ */}
  <PerfMonitor deepAnalyze />
  <YourScene />
</Canvas>`,
      },
    },
  },
};

export const DemandWithHeadless: Story = {
  name: "Demand + Headless",
  args: { mode: "demand" },
  parameters: {
    docs: {
      description: {
        story:
          "A common production setup: `<PerfHeadless />` drives the app's own HUD, `<PerfMonitor deepAnalyze />` is mounted only while debugging, and the canvas renders on demand. Both share one measurement core; the scene stays idle until you orbit, yet the deep-analysis list is already populated.",
      },
      source: {
        language: "tsx",
        code: `<Canvas frameloop="demand">
  {/* Data for your own UI (usePerfData) */}
  <PerfHeadless logsPerSecond={10} />

  {/* Debug panel — deepAnalyze applies even though PerfHeadless mounted first */}
  {debug && <PerfMonitor deepAnalyze />}

  <YourScene />
</Canvas>`,
      },
    },
  },
};
