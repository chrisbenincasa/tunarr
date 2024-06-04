import { QueryClient } from '@tanstack/react-query';
import { map } from 'lodash-es';
import { createBrowserRouter } from 'react-router-dom';
import { Root } from './App.tsx';
import { ErrorPage } from './pages/ErrorPage.tsx';
import ChannelProgrammingPage from './pages/channels/ChannelProgrammingPage.tsx';
import ChannelsPage from './pages/channels/ChannelsPage.tsx';
import EditChannelPage from './pages/channels/EditChannelPage.tsx';
import ProgrammingSelectorPage from './pages/channels/ProgrammingSelectorPage.tsx';
import RandomSlotEditorPage from './pages/channels/RandomSlotEditorPage.tsx';
import TimeSlotEditorPage from './pages/channels/TimeSlotEditorPage.tsx';
import GuidePage from './pages/guide/GuidePage.tsx';
import CustomShowsPage from './pages/library/CustomShowsPage.tsx';
import EditCustomShowPage from './pages/library/EditCustomShowPage.tsx';
import EditFillerPage from './pages/library/EditFillerPage.1.tsx';
import FillerListsPage from './pages/library/FillerListsPage.tsx';
import LibraryIndexPage from './pages/library/LibraryIndexPage.tsx';
import FfmpegSettingsPage from './pages/settings/FfmpegSettingsPage.tsx';
import GeneralSettingsPage from './pages/settings/GeneralSettingsPage.tsx';
import HdhrSettingsPage from './pages/settings/HdhrSettingsPage.tsx';
import PlexSettingsPage from './pages/settings/PlexSettingsPage.tsx';
import SettingsLayout from './pages/settings/SettingsLayout.tsx';
import TaskSettingsPage from './pages/settings/TaskSettingsPage.tsx';
import XmlTvSettingsPage from './pages/settings/XmlTvSettingsPage.tsx';
import ChannelWatchPage from './pages/watch/ChannelWatchPage.tsx';
import WelcomePage from './pages/welcome/WelcomePage.tsx';
import {
  channelLoader,
  editChannelLoader,
  editProgrammingLoader,
} from './preloaders/channelLoaders.ts';
import {
  customShowsLoader,
  existingCustomShowLoader,
  newCustomShowLoader,
} from './preloaders/customShowLoaders.ts';
import {
  existingFillerListLoader,
  fillerListsLoader,
  newFillerListLoader,
} from './preloaders/fillerListLoader.ts';
import { queryCache } from './queryClient.ts';

const queryClient = new QueryClient({ queryCache });

export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: <Root />,
      errorElement: (
        <Root>
          <ErrorPage />
        </Root>
      ),
      children: [
        {
          path: '*',
          errorElement: <ErrorPage />,
        },
        {
          element: <GuidePage channelId="all" />,
          index: true,
        },
        {
          element: <GuidePage channelId="all" />,
          path: '/guide',
        },
        {
          path: '/welcome',
          element: <WelcomePage />,
        },
        {
          path: '/channels',
          element: <ChannelsPage />,
        },
        {
          path: '/channels/:id/edit',
          element: <EditChannelPage isNew={false} />,
          loader: editChannelLoader(false)(queryClient),
        },
        ...map(['flex', 'epg', 'ffmpeg'] as const, (panel) => ({
          path: '/channels/:id/edit/' + panel,
          element: <EditChannelPage isNew={false} initialTab={panel} />,
          loader: editChannelLoader(false)(queryClient),
        })),
        {
          path: '/channels/new',
          element: <EditChannelPage isNew={true} />,
          loader: editChannelLoader(true)(queryClient),
        },
        {
          path: '/channels/:id/programming',
          element: <ChannelProgrammingPage />,
          loader: editProgrammingLoader(queryClient),
        },
        {
          path: '/channels/:id/programming/add',
          element: <ProgrammingSelectorPage />,
        },
        {
          path: '/channels/:id/programming/time-slot-editor',
          element: <TimeSlotEditorPage />,
          loader: editProgrammingLoader(queryClient),
        },
        {
          path: '/channels/:id/programming/random-slot-editor',
          element: <RandomSlotEditorPage />,
          loader: editProgrammingLoader(queryClient),
        },
        {
          path: '/channels/:id/watch',
          element: <ChannelWatchPage />,
          loader: (args) => channelLoader(queryClient)(args),
        },
        {
          path: '/guide',
          element: <GuidePage channelId="all" />,
        },
        {
          path: '/watch',
          element: <ChannelWatchPage />,
        },
        {
          path: '/settings',
          element: <SettingsLayout />,
          children: [
            {
              path: '/settings/general',
              element: <GeneralSettingsPage />,
            },
            {
              path: '/settings/xmltv',
              element: <XmlTvSettingsPage />,
            },
            {
              path: '/settings/ffmpeg',
              element: <FfmpegSettingsPage />,
            },
            {
              path: '/settings/plex',
              element: <PlexSettingsPage />,
            },
            {
              path: '/settings/hdhr',
              element: <HdhrSettingsPage />,
            },
            {
              path: '/settings/tasks',
              element: <TaskSettingsPage />,
            },
          ],
        },
        {
          path: '/library',
          children: [
            {
              path: '/library',
              index: true,
              element: <LibraryIndexPage />,
            },
            {
              path: '/library/custom-shows',
              element: <CustomShowsPage />,
              loader: customShowsLoader(queryClient),
            },
            {
              path: '/library/custom-shows/programming/add',
              element: <ProgrammingSelectorPage />,
            },
            {
              path: '/library/custom-shows/new',
              element: <EditCustomShowPage isNew={true} />,
              loader: newCustomShowLoader(queryClient),
            },
            {
              path: '/library/custom-shows/:id/edit',
              element: <EditCustomShowPage isNew={false} />,
              loader: existingCustomShowLoader(queryClient),
            },
            {
              path: '/library/fillers',
              element: <FillerListsPage />,
              loader: fillerListsLoader(queryClient),
            },
            {
              path: '/library/fillers/programming/add',
              element: <ProgrammingSelectorPage />,
            },
            {
              path: '/library/fillers/new',
              element: <EditFillerPage isNew={true} />,
              loader: newFillerListLoader(queryClient),
            },
            {
              path: '/library/fillers/:id/edit',
              element: <EditFillerPage isNew={false} />,
              loader: existingFillerListLoader(queryClient),
            },
          ],
        },
      ],
    },
  ],
  {
    basename: import.meta.env.BASE_URL,
  },
);
