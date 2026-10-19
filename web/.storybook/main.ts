import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  core: { disableTelemetry: true },

  // The app is served under /web, but Storybook serves from its own root.
  viteFinal: (viteConfig) => ({ ...viteConfig, base: './' }),
};

export default config;
