import { Canvas } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerfMonitor } from "../../src/components/PerfMonitor";
import { usePerfData } from "../../src/hooks/usePerfData";
import { CameraControls, DemandOrbit } from "./CameraControls";
import { PrimitiveScene } from "./PrimitiveScene";

const CAMERA = {
  position: [0, 1.4, 7.6] as [number, number, number],
  fov: 48,
};

type Frameloop = "always" | "demand";

type PaneProps = {
  /** Names the canvas for hooks outside it. */
  id: string;
  /** Primitives around the hero shape; the scene also has the hero and a floor. */
  count: number;
  position: "top-left" | "top-right";
  frameloop: Frameloop;
};

/** Lives outside the canvas, so it picks its canvas by id. */
function PaneTag({ id, count }: { id: string; count: number }) {
  const fps = usePerfData((data) => data.fps, { id });
  const calls = usePerfData((data) => data.gl.calls, { id });

  return (
    <div className="multi-canvas-tag">
      <strong>
        id="{id}" · {count + 2} meshes
      </strong>
      <span>
        {fps.toFixed(0)} FPS · {calls} draw calls
      </span>
    </div>
  );
}

/** One independent canvas with its own monitor. */
function Pane({ id, count, position, frameloop }: PaneProps) {
  return (
    <section className="multi-canvas-pane">
      <Canvas frameloop={frameloop} camera={CAMERA} dpr={[1, 2]}>
        <PerfMonitor id={id} position={position} />
        <PrimitiveScene count={count} />
        {frameloop === "demand" ? <DemandOrbit /> : <CameraControls />}
      </Canvas>
      <PaneTag id={id} count={count} />
    </section>
  );
}

type MultiCanvasDemoProps = {
  /** Primitives in the left canvas. */
  left?: number;
  /** Primitives in the right canvas. */
  right?: number;
  /** With `demand`, a canvas only renders while you move its camera. */
  frameloop?: Frameloop;
};

function MultiCanvasDemo({
  left = 6,
  right = 60,
  frameloop = "always",
}: MultiCanvasDemoProps) {
  return (
    <main className="demo-shell multi-canvas">
      <Pane id="a" count={left} position="top-left" frameloop={frameloop} />
      <Pane id="b" count={right} position="top-right" frameloop={frameloop} />
    </main>
  );
}

const meta = {
  title: "Multi Canvas/Basic Usage",
  component: MultiCanvasDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Two independent `<Canvas>` elements on one page, each with its own `<PerfMonitor />` and a scene of a different weight. Each panel reports the canvas it is mounted in. The labels at the bottom sit outside the canvases and pick theirs with `usePerfData(selector, { id })`.",
      },
      story: { inline: false, iframeHeight: 560 },
    },
  },
  argTypes: {
    left: {
      description: "Primitives in the left canvas.",
      control: { type: "range", min: 0, max: 200, step: 1 },
    },
    right: {
      description: "Primitives in the right canvas.",
      control: { type: "range", min: 0, max: 200, step: 1 },
    },
    frameloop: {
      description: "With `demand`, a canvas only renders while you move its camera.",
      control: "inline-radio",
      options: ["always", "demand"],
    },
  },
  args: {
    left: 6,
    right: 60,
    frameloop: "always",
  },
} satisfies Meta<typeof MultiCanvasDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TwoCanvases: Story = {
  name: "Two canvases",
  parameters: {
    docs: {
      source: {
        language: "tsx",
        code: `function Label({ id }) {
  const fps = usePerfData((data) => data.fps, { id });
  return <span>{fps.toFixed(0)} FPS</span>;
}

<Canvas>
  <PerfMonitor id="a" position="top-left" />
  <SceneA />
</Canvas>
<Label id="a" />

<Canvas>
  <PerfMonitor id="b" position="top-right" />
  <SceneB />
</Canvas>
<Label id="b" />`,
      },
    },
  },
};
