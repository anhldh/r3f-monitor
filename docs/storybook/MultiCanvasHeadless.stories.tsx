import { Canvas } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerfHeadless } from "../../src/components/PerfHeadless";
import { usePerfData } from "../../src/hooks/usePerfData";
import { CameraControls } from "./CameraControls";
import { PrimitiveScene } from "./PrimitiveScene";

const CAMERA = {
  position: [0, 1.4, 7.6] as [number, number, number],
  fov: 48,
};

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <span className="metric-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  );
}

/** Your own dashboard, outside the canvas: `id` says which canvas it reads. */
function CustomHud({ id }: { id: string }) {
  const data = usePerfData({ id });

  return (
    <aside className="metrics-hud" aria-label={`Performance dashboard for canvas ${id}`}>
      <Metric label="FPS" value={data.fps > 0 ? data.fps.toFixed(0) : "-"} />
      <Metric label="CPU" value={data.cpu.toFixed(2)} unit="ms" />
      <Metric label="GPU" value={data.gpu.toFixed(2)} unit="ms" />
      <Metric label="VRAM" value={data.vram.toFixed(1)} unit="MB" />
      <Metric label="Draw calls" value={String(data.gl.calls)} />
      <Metric label="Triangles" value={data.gl.triangles.toLocaleString()} />
    </aside>
  );
}

/** One canvas measured without the built-in panel, plus its own dashboard. */
function Pane({ id, count }: { id: string; count: number }) {
  return (
    <section className="multi-canvas-pane">
      <Canvas camera={CAMERA} dpr={[1, 2]}>
        <PerfHeadless id={id} />
        <PrimitiveScene count={count} />
        <CameraControls />
      </Canvas>
      <CustomHud id={id} />
      <div className="multi-canvas-tag">
        <strong>id="{id}"</strong>
        <span>{count + 2} meshes</span>
      </div>
    </section>
  );
}

function MultiCanvasHeadlessDemo() {
  return (
    <main className="demo-shell multi-canvas">
      <Pane id="a" count={6} />
      <Pane id="b" count={60} />
    </main>
  );
}

const meta = {
  title: "Multi Canvas/Headless UI",
  component: MultiCanvasHeadlessDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Two canvases measured by `<PerfHeadless />`, with no built-in panel. Each dashboard is ordinary React outside its canvas, so it names the canvas it reads: `<PerfHeadless id=\"a\" />` on one side, `usePerfData({ id: \"a\" })` on the other. Without `id`, a hook outside a canvas reads the first measured canvas.",
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
} satisfies Meta<typeof MultiCanvasHeadlessDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomDashboards: Story = {
  name: "Custom dashboards",
  parameters: {
    docs: {
      source: {
        language: "tsx",
        code: `function Hud({ id }) {
  // Everything for one canvas; usePerfData(selector, { id }) reads one field
  const { fps, cpu, gpu, gl } = usePerfData({ id });
  return <div>{fps > 0 ? fps.toFixed(0) : "-"} FPS · {gl.calls} calls</div>;
}

<Canvas>
  <PerfHeadless id="a" />
  <SceneA />
</Canvas>
<Hud id="a" />

<Canvas>
  <PerfHeadless id="b" />
  <SceneB />
</Canvas>
<Hud id="b" />`,
      },
    },
  },
};
