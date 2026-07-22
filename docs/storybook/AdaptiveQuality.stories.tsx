import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerfHeadless } from "../../src/components/PerfHeadless";
import { PerfAdaptive } from "../../src/performance/PerfAdaptive";
import { AdaptiveEngine } from "../../src/performance/AdaptiveEngine";
import { DemoScene } from "./DemoScene";

type AdaptiveArgs = React.ComponentProps<typeof PerfAdaptive>;

function AdaptiveCanvas(args: AdaptiveArgs) {
  const [factor, setFactor] = useState(args.factor ?? 0.5);
  const [fps, setFps] = useState(0);
  const [bound, setBound] = useState("Learning");
  const dpr = 0.75 + factor * 1.25;

  useEffect(() => setFactor(args.factor ?? 0.5), [args.factor]);

  return (
    <main className="demo-shell">
      <Canvas className="demo-canvas" camera={{ position: [0, 1.1, 7.2], fov: 48 }} dpr={dpr}>
        <PerfHeadless logsPerSecond={10} />
        <PerfAdaptive
          key={`${args.factor}-${args.iterations}-${args.threshold}-${args.step}`}
          {...args}
          onChange={(engine) => {
            setFactor(engine.factor);
            setFps(engine.fps);
            setBound(engine.gpu > engine.cpu ? "GPU" : "CPU");
          }}
        />
        <DemoScene quality={factor} />
      </Canvas>
      <aside className="adaptive-panel">
        <span className="panel-eyebrow">Live adaptive quality</span>
        <h3 className="panel-title">Quality factor {(factor * 100).toFixed(0)}%</h3>
        <div className="quality-track">
          <div className="quality-fill" style={{ width: `${factor * 100}%` }} />
        </div>
        <div className="quality-grid">
          <div><span>DPR</span><strong>{dpr.toFixed(2)}</strong></div>
          <div><span>Last FPS</span><strong>{fps ? fps.toFixed(0) : "—"}</strong></div>
          <div><span>Bound by</span><strong>{bound}</strong></div>
        </div>
      </aside>
      <div className="demo-caption">
        <strong>Map one factor to every quality lever</strong>
        <span>This demo adjusts DPR and scene complexity from the same 0–1 factor.</span>
      </div>
    </main>
  );
}

type EngineSnapshot = {
  factor: number;
  fps: number;
  gpu: number;
  cpu: number;
  event: string;
  fallback: boolean;
};

function EngineSimulator(args: AdaptiveArgs) {
  const [snapshot, setSnapshot] = useState<EngineSnapshot>({
    factor: args.factor ?? 0.5,
    fps: 0,
    gpu: 0,
    cpu: 0,
    event: "Waiting for samples",
    fallback: false,
  });

  const iterations = args.iterations ?? 10;
  const engine = useMemo(
    () =>
      new AdaptiveEngine({
        iterations,
        threshold: args.threshold,
        step: args.step,
        factor: args.factor,
        flipflops: args.flipflops,
        bounds: args.bounds,
        onIncline: (current) =>
          setSnapshot({
            factor: current.factor,
            fps: current.fps,
            gpu: current.gpu,
            cpu: current.cpu,
            event: "Incline: quality increased",
            fallback: current.fallback,
          }),
        onDecline: (current) =>
          setSnapshot({
            factor: current.factor,
            fps: current.fps,
            gpu: current.gpu,
            cpu: current.cpu,
            event: "Decline: quality reduced",
            fallback: current.fallback,
          }),
        onFallback: (current) =>
          setSnapshot((value) => ({ ...value, event: "Fallback triggered", fallback: current.fallback })),
      }),
    [args.bounds, args.factor, args.flipflops, args.step, args.threshold, iterations],
  );

  useEffect(() => {
    setSnapshot({
      factor: engine.factor,
      fps: 0,
      gpu: 0,
      cpu: 0,
      event: "Waiting for samples",
      fallback: false,
    });
  }, [engine]);

  const feed = (sampleFps: number, gpu: number, cpu: number) => {
    for (let index = 0; index < iterations; index += 1) {
      engine.addSample(sampleFps, gpu, cpu);
    }
    setSnapshot((value) => ({
      ...value,
      factor: engine.factor,
      fps: engine.fps,
      gpu: engine.gpu,
      cpu: engine.cpu,
      fallback: engine.fallback,
    }));
  };

  return (
    <main className="engine-layout">
      <section className="engine-panel">
        <span className="panel-eyebrow">AdaptiveEngine simulator</span>
        <h3 className="panel-title">{snapshot.event}</h3>
        <p className="engine-copy">
          Feed a complete sample window to inspect decisions without React or Canvas. GPU and CPU
          time are included in every callback so you can reduce the correct workload.
        </p>
        <div className="quality-track" style={{ marginTop: 18 }}>
          <div className="quality-fill" style={{ width: `${snapshot.factor * 100}%` }} />
        </div>
        <div className="quality-grid">
          <div><span>Factor</span><strong>{snapshot.factor.toFixed(2)}</strong></div>
          <div><span>FPS</span><strong>{snapshot.fps || "—"}</strong></div>
          <div><span>Bottleneck</span><strong>{snapshot.gpu > snapshot.cpu ? "GPU" : snapshot.cpu ? "CPU" : "—"}</strong></div>
        </div>
        <div className="engine-actions">
          <button type="button" onClick={() => feed(60, 4, 2)}>Feed fast GPU samples</button>
          <button type="button" onClick={() => feed(24, 28, 8)}>Feed GPU-bound samples</button>
          <button type="button" onClick={() => feed(24, 7, 22)}>Feed CPU-bound samples</button>
        </div>
      </section>
    </main>
  );
}

const meta = {
  title: "Guides/Adaptive Quality",
  component: PerfAdaptive,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "PerfAdaptive listens to the monitor engine and maintains a 0–1 factor from sustained FPS. Map the factor to DPR, shadows, effects, draw distance or scene complexity.",
      },
      story: { inline: false, iframeHeight: 520 },
    },
  },
  argTypes: {
    iterations: {
      description: "FPS samples collected before each quality decision.",
      control: { type: "range", min: 2, max: 30, step: 1 },
    },
    threshold: {
      description: "Fraction of samples that must cross a bound before changing quality.",
      control: { type: "range", min: 0.5, max: 1, step: 0.05 },
    },
    step: {
      description: "Amount added to or removed from the 0–1 quality factor.",
      control: { type: "range", min: 0.05, max: 0.5, step: 0.05 },
    },
    factor: {
      description: "Initial quality factor before runtime samples are evaluated.",
      control: { type: "range", min: 0, max: 1, step: 0.05 },
    },
    flipflops: {
      description: "Maximum incline/decline changes before fallback is triggered.",
      control: "number",
    },
    bounds: {
      description: "Return the lower and upper FPS bounds for a detected refresh rate.",
      control: false,
    },
    children: { table: { disable: true } },
    onIncline: { table: { disable: true } },
    onDecline: { table: { disable: true } },
    onChange: { table: { disable: true } },
    onFallback: { table: { disable: true } },
  },
  args: {
    iterations: 10,
    threshold: 0.75,
    step: 0.1,
    factor: 0.5,
    flipflops: 100,
  },
  render: (args) => <AdaptiveCanvas {...args} />,
} satisfies Meta<typeof PerfAdaptive>;

export default meta;
type Story = StoryObj<typeof meta>;

export const LiveDprAndComplexity: Story = {
  parameters: {
    docs: {
      source: {
        language: "tsx",
        code: `function App() {
  const [dpr, setDpr] = useState(1);
  return <Canvas dpr={dpr}>
    <PerfHeadless />
    <PerfAdaptive onChange={(e) => setDpr(0.5 + e.factor * 1.5)} />
    <YourScene />
  </Canvas>;
}`,
      },
    },
  },
};

export const DecisionEngine: Story = {
  parameters: {
    docs: {
      source: {
        language: "ts",
        code: `const engine = new AdaptiveEngine({
  factor: 0.5,
  onChange: ({ factor }) => setQuality(factor),
});

engine.addSample(fps, gpuTime, cpuTime);`,
      },
    },
  },
  render: (args) => <EngineSimulator {...args} />,
};
