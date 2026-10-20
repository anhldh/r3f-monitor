import type { Preview } from "@storybook/react-vite";
import "../docs/storybook/storybook.css";

const preview: Preview = {
  parameters: {
    docs: {
      defaultName: "Docs",
    },
    options: {
      storySort: {
        order: [
          "R3F Monitor",
          "Components",
          "Guides",
          "WebGPU",
          "Multi Canvas",
          ["Basic Usage", "WebGPU", "Headless UI", "Adaptive Quality"],
        ],
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
