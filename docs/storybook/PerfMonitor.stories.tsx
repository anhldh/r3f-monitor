import { Canvas } from "@react-three/fiber";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { PerfMonitor } from "../../src/components/PerfMonitor";
import { DemoScene } from "./DemoScene";

type MonitorDemoProps = React.ComponentProps<typeof PerfMonitor> & {
  caption?: string;
};

function MonitorDemo({ caption, ...props }: MonitorDemoProps) {
  return (
    <main className="demo-shell">
      <Canvas className="demo-canvas" camera={{ position: [0, 1.1, 7.2], fov: 48 }} dpr={[1, 2]}>
        <PerfMonitor {...props} />
        <DemoScene />
      </Canvas>
      <div className="demo-caption">
        <strong>{props.displayType === "classic" ? "Classic display" : "Tab display"}</strong>
        <span>{caption}</span>
      </div>
    </main>
  );
}

const meta = {
  title: "Components/PerfMonitor",
  component: PerfMonitor,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Ready-made monitoring UI. Mount it inside a React Three Fiber Canvas; it starts the shared measurement engine automatically.",
      },
      story: { inline: false, iframeHeight: 520 },
    },
  },
  argTypes: {
    displayType: {
      description: "Choose the structured Tab UI or the compact Classic panel.",
      control: "inline-radio",
      options: ["tab", "classic"],
    },
    graphType: {
      description: "Render metric history as scrolling bars or continuous lines.",
      control: "inline-radio",
      options: ["bar", "line"],
    },
    position: {
      description: "Anchor the monitor to a viewport corner.",
      control: "select",
      options: ["top-right", "top-left", "bottom-right", "bottom-left"],
    },
    logsPerSecond: {
      description: "How often the public metrics and UI values refresh each second.",
      control: { type: "range", min: 1, max: 30, step: 1 },
    },
    showGraph: { description: "Show or hide the performance history graph." },
    minimal: { description: "Keep only the hot metrics in a condensed panel." },
    deepAnalyze: { description: "Collect and expose individual WebGL program details." },
    matrixUpdate: { description: "Count matrixWorld updates for each frame." },
    antialias: { description: "Enable antialiasing for the line graph canvas." },
    openByDefault: { description: "Start the Classic panel in its expanded state." },
    chart: {
      description: "Graph sampling frequency and retained history length.",
      control: "object",
    },
    style: { description: "Inline style override for the monitor container.", control: "object" },
    className: { description: "Custom class added to the monitor container.", control: "text" },
    perfContainerRef: { table: { disable: true } },
  },
  args: {
    displayType: "tab",
    showGraph: true,
    graphType: "bar",
    position: "top-right",
    logsPerSecond: 10,
    minimal: false,
    deepAnalyze: false,
    matrixUpdate: false,
    antialias: true,
    openByDefault: true,
    chart: { hz: 60, length: 120 },
  },
  render: (args) => (
    <MonitorDemo {...args} caption="Use the toolbar controls to explore every public display option." />
  ),
} satisfies Meta<typeof PerfMonitor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const TabDisplay: Story = {};

export const ClassicDisplay: Story = {
  args: {
    displayType: "classic",
    openByDefault: true,
  },
  render: (args) => (
    <MonitorDemo {...args} caption="A compact, always-visible summary with expandable render details." />
  ),
};

export const Minimal: Story = {
  args: {
    displayType: "classic",
    minimal: true,
    showGraph: false,
  },
  render: (args) => (
    <MonitorDemo {...args} caption="Minimal mode keeps only the hot metrics for a low-profile HUD." />
  ),
};

export const LineGraph: Story = {
  args: {
    displayType: "classic",
    graphType: "line",
    showGraph: true,
    openByDefault: true,
  },
  render: (args) => (
    <MonitorDemo {...args} caption="Switch graphType to line for a continuous time-series view." />
  ),
};

export const DeepAnalysis: Story = {
  args: {
    displayType: "tab",
    deepAnalyze: true,
    matrixUpdate: true,
  },
  render: (args) => (
    <MonitorDemo
      {...args}
      caption="Open the code icon to inspect WebGL programs; the RES tab includes matrix updates."
    />
  ),
};

export const BottomLeft: Story = {
  args: {
    position: "bottom-left",
  },
  render: (args) => (
    <MonitorDemo {...args} caption="The monitor can anchor to any corner of the viewport." />
  ),
};
