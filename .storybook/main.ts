import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    "../docs/storybook/**/*.mdx",
    "../docs/storybook/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  addons: ["@storybook/addon-docs"],
  framework: "@storybook/react-vite",
  core: {
    disableWhatsNewNotifications: true,
  },
  features: {
    interactions: false,
    actions: false,
    sidebarOnboardingChecklist: false,
    menuOnboardingChecklist: false,
  },
};
export default config;
