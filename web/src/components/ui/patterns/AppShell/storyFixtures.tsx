import {
  Computer,
  Home,
  Settings,
  SettingsRemote,
  Tv,
  VideoLibrary,
} from '@mui/icons-material';
import type { ShellNav, ShellNavSection } from './navModel.ts';

// Story-only nav data. Nothing in the app imports this file.

const library: ShellNavSection = {
  id: 'library',
  label: 'Library',
  to: '/library',
  icon: <VideoLibrary />,
  pages: [
    { id: 'libraries', label: 'Libraries', to: '/library', exact: true },
    { id: 'custom-shows', label: 'Custom Shows', to: '/library/custom-shows' },
    { id: 'fillers', label: 'Filler Lists', to: '/library/fillers' },
    {
      id: 'smart-collections',
      label: 'Smart Collections',
      to: '/library/smart_collections',
    },
    { id: 'trash', label: 'Trash', to: '/library/trash' },
  ],
};

const system: ShellNavSection = {
  id: 'system',
  label: 'System',
  to: '/system',
  icon: <Computer />,
  pages: [
    { id: 'status', label: 'Status', to: '/system', exact: true },
    { id: 'tasks', label: 'Tasks', to: '/system/tasks' },
    { id: 'logs', label: 'Logs', to: '/system/logs' },
    { id: 'debug', label: 'Debug', to: '/system/debug' },
    { id: 'troubleshoot', label: 'Troubleshoot', to: '/system/troubleshoot' },
  ],
};

export const storyNav: ShellNav = {
  sections: [
    {
      id: 'welcome',
      label: 'Welcome',
      to: '/welcome',
      icon: <Home />,
      pages: [],
      hidden: true,
    },
    { id: 'guide', label: 'Guide', to: '/guide', icon: <Tv />, pages: [] },
    {
      id: 'channels',
      label: 'Channels',
      to: '/channels',
      icon: <SettingsRemote />,
      pages: [],
    },
    library,
    system,
  ],
  settings: {
    id: 'settings',
    label: 'Settings',
    to: '/settings/general',
    icon: <Settings />,
    pages: [
      { id: 'general', label: 'General', to: '/settings/general' },
      { id: 'sources', label: 'Sources', to: '/settings/sources' },
      { id: 'xmltv', label: 'XMLTV', to: '/settings/xmltv' },
      { id: 'ffmpeg', label: 'FFmpeg', to: '/settings/ffmpeg' },
      { id: 'hdhr', label: 'HDHR', to: '/settings/hdhr' },
      { id: 'scanner', label: 'Scanner', to: '/settings/scanner' },
      { id: 'features', label: 'Features', to: '/settings/features' },
    ],
  },
};

export const withWelcome: ShellNav = {
  ...storyNav,
  sections: storyNav.sections.map((s) =>
    s.id === 'welcome' ? { ...s, hidden: false } : s,
  ),
};

export const withHealthBadge: ShellNav = {
  ...storyNav,
  sections: storyNav.sections.map((s) =>
    s.id === 'system' ? { ...s, badge: { count: 3, severity: 'error' } } : s,
  ),
};

const relabel = (
  section: ShellNavSection,
  label: string,
  pageLabels: string[] = [],
): ShellNavSection => ({
  ...section,
  label,
  pages: section.pages.map((page, i) => ({
    ...page,
    label: pageLabels[i] ?? page.label,
  })),
});

const spanish: Record<string, [string, string[]?]> = {
  guide: ['Guía'],
  channels: ['Canales'],
  library: [
    'Biblioteca',
    [
      'Bibliotecas',
      'Programas personalizados',
      'Listas de relleno',
      'Colecciones inteligentes',
      'Papelera',
    ],
  ],
  system: ['Sistema', ['Estado', 'Tareas', 'Registros', 'Depuración']],
};

// Stand-in Spanish labels, which run about 40% longer than English.
export const longLabelNav: ShellNav = {
  sections: storyNav.sections.flatMap((section) => {
    const labels = spanish[section.id];
    return labels ? [relabel(section, labels[0], labels[1])] : [];
  }),
  settings: relabel(storyNav.settings, 'Configuración'),
};

export const grownNav: ShellNav = {
  ...longLabelNav,
  sections: [
    ...longLabelNav.sections,
    {
      id: 'future',
      label: 'Sección futura',
      to: '/guide',
      icon: <Tv />,
      pages: [],
    },
    {
      id: 'another',
      label: 'Otra sección con nombre largo',
      to: '/guide',
      icon: <Tv />,
      pages: [],
    },
  ],
};
