import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerfHeadless } from "../../src/components/PerfHeadless";
import { usePerfData } from "../../src/hooks/usePerfData";
import { PerfAdaptive } from "../../src/performance/PerfAdaptive";
import { CameraControls } from "./CameraControls";
import { PrimitiveScene } from "./PrimitiveScene";

const CAMERA = {
  position: [0, 1.4, 7.6] as [number, number, number],
  fov: 48,
};

type PaneProps = {
  /** Names the canvas for the readout outside it. */
  id: string;
  /** Primitives at full quality. */
  count: number;
  /** Quality factor the canvas starts from. */
  startFactor: number;
};

/** One canvas with its own adaptive engine, DPR and scene complexity. */
function Pane({ id, count, startFactor }: PaneProps) {
  const [factor, setFactor] = useState(startFactor);
  const dpr = 0.75 + factor * 1.25;

  // The readout is outside the canvas, so it picks its canvas by id.
  const fps = usePerfData((data) => data.fps, { id });
  const gpu = usePerfData((data) => data.gpu, { id });
  const cpu = usePerfData((data) => data.cpu, { id });

  return (
    <section className="multi-canvas-pane">
      <Canvas camera={CAMERA} dpr={dpr}>
        <PerfHeadless id={id} />
        {/* Inside the canvas: follows this canvas, no id needed */}
        <PerfAdaptive
          factor={startFactor}
          onChange={(engine) => setFactor(engine.factor)}
        />
        <PrimitiveScene count={Math.round(count * (0.25 + factor * 0.75))} />
        <CameraControls />
      </Canvas>
      <aside className="adaptive-panel">
        <span className="panel-eyebrow">Canvas id="{id}"</span>
        <h3 className="panel-title">
          Quality {(factor * 100).toFixed(0)}% · DPR {dpr.toFixed(2)}
        </h3>
        <div className="quality-track">
          <div className="quality-fill" style={{ width: `${factor * 100}%` }} />
        </div>
        <div className="quality-grid">
          <div><span>FPS</span><strong>{fps.toFixed(0)}</strong></div>
          <div><span>GPU ms</span><strong>{gpu.toFixed(2)}</strong></div>
          <div><span>CPU ms</span><strong>{cpu.toFixed(2)}</strong></div>
        </div>
      </aside>
    </section>
  );
}

function MultiCanvasAdaptiveDemo() {
  return (
    <main className="demo-shell multi-canvas">
      <Pane id="a" count={12} startFactor={0.75} />
      <Pane id="b" count={160} startFactor={0.25} />
    </main>
  );
}

const meta = {
  title: "Multi Canvas/Adaptive Quality",
  component: MultiCanvasAdaptiveDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component: [
          "Each canvas has its own `<PerfAdaptive />` engine and its own quality factor, mapped here to DPR and scene complexity. Placed inside a canvas, `<PerfAdaptive />` follows that canvas with no extra setup; placed outside, give it the canvas `id`.",
          "",
          "All canvases render in React Three Fiber's single loop, so with the default `frameloop` they share the same FPS and their factors move together. What differs per canvas is the **GPU / CPU time** each engine receives (`engine.gpu`, `engine.cpu`), which tells you which canvas is worth lightening.",
        ].join("\n"),
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
} satisfies Meta<typeof MultiCanvasAdaptiveDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const QualityPerCanvas: Story = {
  name: "Quality per canvas",
  parameters: {
    docs: {
      source: {
        language: "tsx",
        code: `function AdaptiveCanvas({ children }) {
  const [dpr, setDpr] = useState(1);
  return (
    <Canvas dpr={dpr}>
      <PerfHeadless />
      {/* Inside the canvas: follows this canvas */}
      <PerfAdaptive onChange={(engine) => setDpr(0.5 + engine.factor * 1.5)} />
      {children}
    </Canvas>
  );
}

<AdaptiveCanvas><SceneA /></AdaptiveCanvas>
<AdaptiveCanvas><SceneB /></AdaptiveCanvas>`,
      },
    },
  },
};
