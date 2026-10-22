import '@fontsource-variable/ibm-plex-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
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

    // Violations show in the a11y panel and as test warnings, but never fail
    // the run. Switch to 'error' once existing stories pass.
    a11y: { test: 'todo' },
  },
};

export default preview;
