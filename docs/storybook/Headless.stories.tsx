import { Canvas } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerfHeadless } from "../../src/components/PerfHeadless";
import { usePerfData } from "../../src/hooks/usePerfData";
import { DemoScene } from "./DemoScene";

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

function CustomHud() {
  const data = usePerfData();

  return (
    <aside className="metrics-hud" aria-label="Custom performance dashboard">
      <Metric label="FPS" value={data.fps.toFixed(0)} />
      <Metric label="CPU" value={data.cpu.toFixed(2)} unit="ms" />
      <Metric label="GPU" value={data.gpu.toFixed(2)} unit="ms" />
      <Metric label="VRAM" value={data.vram.toFixed(1)} unit="MB" />
      <Metric label="Draw calls" value={String(data.gl.calls)} />
      <Metric label="Triangles" value={data.gl.triangles.toLocaleString()} />
    </aside>
  );
}

function HeadlessDemo(props: React.ComponentProps<typeof PerfHeadless>) {
  return (
    <main className="demo-shell">
      <Canvas className="demo-canvas" camera={{ position: [0, 1.1, 7.2], fov: 48 }} dpr={[1, 2]}>
        <PerfHeadless {...props} />
        <DemoScene />
      </Canvas>
      <CustomHud />
      <div className="demo-caption">
        <strong>Bring your own UI</strong>
        <span>The dashboard is outside Canvas and subscribes through usePerfData().</span>
      </div>
    </main>
  );
}

const meta = {
  title: "Guides/Headless UI",
  component: PerfHeadless,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "PerfHeadless runs the shared measurement engine without rendering an interface. Read its throttled values from any React component with usePerfData().",
      },
      story: { inline: false, iframeHeight: 520 },
    },
  },
  argTypes: {
    logsPerSecond: {
      description: "Throttle store/UI updates without changing per-frame measurement accuracy.",
      control: { type: "range", min: 1, max: 30, step: 1 },
    },
    deepAnalyze: { description: "Collect individual WebGL program details." },
    matrixUpdate: { description: "Count matrixWorld updates each frame." },
    chart: {
      description: "Graph sampling frequency and retained history length for subscribers.",
      control: "object",
    },
  },
  args: {
    logsPerSecond: 10,
    deepAnalyze: false,
    matrixUpdate: false,
    chart: { hz: 60, length: 120 },
  },
  render: (args) => <HeadlessDemo {...args} />,
} satisfies Meta<typeof PerfHeadless>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CustomDashboard: Story = {
  parameters: {
    docs: {
      source: {
        language: "tsx",
        code: `function MyHud() {
  const { fps, cpu, gpu, vram, gl } = usePerfData();
  return <div>{fps.toFixed(0)} FPS · {gl.calls} calls</div>;
}

export default function App() {
  return <>
    <Canvas><PerfHeadless logsPerSecond={10} /><YourScene /></Canvas>
    <MyHud />
  </>;
}`,
      },
    },
  },
};

export const FpsSelector: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "For small widgets, use a selector such as usePerfData(data => data.fps) so React only re-renders when that value changes.",
      },
      source: {
        language: "tsx",
        code: `function FpsBadge() {
  const fps = usePerfData((data) => data.fps);
  return <span>{fps.toFixed(0)} FPS</span>;
}`,
      },
    },
  },
};
