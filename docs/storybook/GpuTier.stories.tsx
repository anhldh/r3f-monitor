import { Suspense } from "react";
import type { TierResult } from "@pmndrs/detect-gpu";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { GpuTier } from "../../src/performance/useGpuTier";

function TierDetails({ result }: { result: TierResult }) {
  const recommendation = [
    "Use a lightweight fallback experience",
    "Low shadows, DPR up to 1 and simple materials",
    "Medium shadows, DPR up to 1.5 and selective effects",
    "High-quality effects, shadows and DPR up to 2",
  ][result.tier];

  return (
    <section className="tier-panel">
      <div className="tier-badge">{result.tier}</div>
      <span className="panel-eyebrow">Detected starting tier</span>
      <h3 className="panel-title">{result.gpu || "GPU renderer unavailable"}</h3>
      <p className="tier-copy">
        {recommendation}. Use this as an initial preset, then let PerfAdaptive refine quality from
        real runtime measurements.
      </p>
      <div className="tier-grid">
        <div><span>Tier</span><strong>{result.tier} / 3</strong></div>
        <div><span>Device</span><strong>{result.isMobile ? "Mobile" : "Desktop"}</strong></div>
        <div><span>Detection</span><strong>{result.type}</strong></div>
      </div>
    </section>
  );
}

function DetectionDemo(props: React.ComponentProps<typeof GpuTier>) {
  return (
    <main className="tier-layout">
      <Suspense fallback={<div className="loading-card">Detecting GPU tier…</div>}>
        <GpuTier {...props}>{(result) => <TierDetails result={result} />}</GpuTier>
      </Suspense>
    </main>
  );
}

const meta = {
  title: "Guides/GPU Tier",
  component: GpuTier,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "GpuTier and useGpuTier classify the current GPU from 0 (weakest) to 3 (strongest). The hook suspends, so render it beneath Suspense. This docs preview pins a renderer through detect-gpu's override option so it also works offline; omit override in your app to inspect the real device.",
      },
      story: { inline: false, iframeHeight: 460 },
    },
  },
  argTypes: {
    children: { table: { disable: true } },
    glContext: { table: { disable: true } },
    override: { table: { disable: true } },
    benchmarksURL: {
      description: "Optional self-hosted directory for detect-gpu benchmark JSON files.",
    },
    failIfMajorPerformanceCaveat: {
      description: "Reject software or severely degraded WebGL contexts.",
    },
    mobileTiers: { description: "Custom FPS thresholds for mobile tiers 0–3." },
    desktopTiers: { description: "Custom FPS thresholds for desktop tiers 0–3." },
  },
  args: {
    override: {
      renderer: "apple gpu",
      isMobile: false,
    },
  },
  render: (args) => <DetectionDemo {...args} />,
} satisfies Meta<typeof GpuTier>;

export default meta;
type Story = StoryObj<typeof meta>;

export const StartingQuality: Story = {
  parameters: {
    docs: {
      source: {
        language: "tsx",
        code: `function Effects() {
  const { tier } = useGpuTier();
  return tier >= 2 ? <FancyPostProcessing /> : null;
}

<Suspense fallback={null}>
  <Effects />
</Suspense>`,
      },
    },
  },
};
