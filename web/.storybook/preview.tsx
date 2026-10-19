import '@fontsource-variable/geist-mono';
import '@fontsource-variable/plus-jakarta-sans';
import type { Decorator, Preview } from '@storybook/react-vite';
import { StoryProviders } from './StoryProviders.tsx';

const withAppProviders: Decorator = (Story, context) => (
  <StoryProviders
    density={context.globals['density'] === 'dense' ? 'dense' : 'comfortable'}
    scheme={context.globals['scheme'] === 'light' ? 'light' : 'dark'}
  >
    <Story />
  </StoryProviders>
);

const preview: Preview = {
  decorators: [withAppProviders],
  globalTypes: {
    scheme: {
      description: 'Color scheme',
      toolbar: {
        title: 'Scheme',
        icon: 'mirror',
        items: [
          { value: 'dark', title: 'Dark' },
          { value: 'light', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
    density: {
      description: 'Density',
      toolbar: {
        title: 'Density',
        icon: 'component',
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'dense', title: 'Dense' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { scheme: 'dark', density: 'comfortable' },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true },
  },
};

export default preview;
