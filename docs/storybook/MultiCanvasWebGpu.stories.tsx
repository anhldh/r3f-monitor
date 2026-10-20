import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerfMonitor } from "../../src/components/PerfMonitor";
import { usePerfData } from "../../src/hooks/usePerfData";
import { CameraControls } from "./CameraControls";
import { ComputeParticles } from "./ComputeParticles";
import { PrimitiveScene } from "./PrimitiveScene";
import { WebGpuCanvas } from "./WebGpuCanvas";

const CAMERA = {
  position: [0, 1.6, 8] as [number, number, number],
  fov: 48,
};

type PaneProps = {
  /** Names the canvas for hooks outside it. */
  id: string;
  /** Primitives around the hero shape. */
  count: number;
  /** Particles simulated by the compute shader. */
  particles: number;
  position: "top-left" | "top-right";
};

/** Lives outside the canvas, so it picks its canvas by id. */
function PaneTag({ id, count, particles }: Omit<PaneProps, "position">) {
  const api = usePerfData((data) => data.infos.api, { id });
  const fps = usePerfData((data) => data.fps, { id });
  const calls = usePerfData((data) => data.gl.calls, { id });
  const gpuCompute = usePerfData((data) => data.gpuCompute, { id });

  return (
    <div className="multi-canvas-tag">
      <strong>
        id="{id}" · {count} obj · {particles / 1000}k pts
      </strong>
      <span>
        {api === "webgpu" ? "WebGPU" : "WebGL 2"} · {fps > 0 ? fps.toFixed(0) : "-"} FPS ·{" "}
        {calls} draw calls · {gpuCompute.toFixed(3)} ms compute
      </span>
    </div>
  );
}

/** One independent WebGPURenderer canvas with its own monitor. */
function Pane({ id, count, particles, position }: PaneProps) {
  return (
    <section className="multi-canvas-pane">
      <WebGpuCanvas camera={CAMERA} dpr={[1, 2]}>
        <PerfMonitor id={id} position={position} />
        <PrimitiveScene count={count} />
        <ComputeParticles count={particles} size={0.05} />
        <CameraControls />
      </WebGpuCanvas>
      <PaneTag id={id} count={count} particles={particles} />
    </section>
  );
}

function WebGpuMultiCanvasDemo() {
  return (
    <main className="demo-shell multi-canvas">
      <Pane id="a" count={12} particles={25_000} position="top-left" />
      <Pane id="b" count={80} particles={150_000} position="top-right" />
    </main>
  );
}

const meta = {
  title: "Multi Canvas/WebGPU",
  component: WebGpuMultiCanvasDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Two `WebGPURenderer` canvases on one page, each with its own `<PerfMonitor />`, scene and compute-shader particle field. Every renderer has its own device, so draw calls, VRAM, GPU time and **GPU compute** are reported per canvas. The labels at the bottom sit outside the canvases and pick theirs with `usePerfData(selector, { id })`.",
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
} satisfies Meta<typeof WebGpuMultiCanvasDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoCanvases: Story = {
  name: "Two canvases",
  parameters: {
    docs: {
      source: {
        language: "tsx",
        code: `const gl = async (props) => {
  const renderer = new WebGPURenderer({ canvas: props.canvas });
  await renderer.init();
  return renderer;
};

<Canvas gl={gl}>
  <PerfMonitor id="a" position="top-left" />
  <SceneA />
</Canvas>

<Canvas gl={gl}>
  <PerfMonitor id="b" position="top-right" />
  <SceneB />
</Canvas>`,
      },
    },
  },
};
