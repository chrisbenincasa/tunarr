import { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter } from 'react-router-dom';
import App, { Root } from './App.tsx';
import ChannelProgrammingPage from './pages/channels/ChannelProgrammingPage.tsx';
import ChannelsPage from './pages/channels/ChannelsPage.tsx';
import EditExistingChannelPage from './pages/channels/EditExistingChannelPage.tsx';
import NewChannelPage from './pages/channels/NewChannelPage.tsx';
import {
  customShowsLoader,
  editChannelLoader,
  editProgrammingLoader,
  existingCustomShowLoader,
  newChannelLoader,
  newCustomShowLoader,
} from './pages/channels/loaders.ts';
import GuidePage from './pages/guide/GuidePage.tsx';
import CustomShowsPage from './pages/library/CustomShowsPage.tsx';
import EditCustomShowPage from './pages/library/EditCustomShowPage.tsx';
import FillerListsPage from './pages/library/FillerListsPage.tsx';
import LibraryIndexPage from './pages/library/LibraryIndexPage.tsx';
import FfmpegSettingsPage from './pages/settings/FfmpegSettingsPage.tsx';
import GeneralSettingsPage from './pages/settings/GeneralSettingsPage.tsx';
import HdhrSettingsPage from './pages/settings/HdhrSettingsPage.tsx';
import PlexSettingsPage from './pages/settings/PlexSettingsPage.tsx';
import SettingsLayout from './pages/settings/SettingsLayout.tsx';
import XmlTvSettingsPage from './pages/settings/XmlTvSettingsPage.tsx';
import { queryCache } from './queryClient.ts';
import TimeSlotEditorPage from './pages/channels/TimeSlotEditorPage.tsx';

const queryClient = new QueryClient({ queryCache });

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Root />,
    children: [
      {
        element: <App />,
        index: true,
      },
      {
        path: '/channels',
        element: <ChannelsPage />,
      },
      {
        path: '/channels/:id/edit',
        element: <EditExistingChannelPage />,
        loader: editChannelLoader(queryClient),
      },
      {
        path: '/channels/new',
        element: <NewChannelPage />,
        loader: newChannelLoader(queryClient),
      },
      {
        path: '/channels/:id/programming',
        element: <ChannelProgrammingPage />,
        loader: editProgrammingLoader(queryClient),
      },
      {
        path: '/channels/:id/programming/time-slot-editor',
        element: <TimeSlotEditorPage />,
        loader: editProgrammingLoader(queryClient),
      },
      {
        path: '/guide',
        element: <GuidePage />,
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
            path: '/library/filler',
            element: <FillerListsPage />,
          },
          {
            path: '/library/custom-shows',
            element: <CustomShowsPage />,
            loader: customShowsLoader(queryClient),
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
            element: <CustomShowsPage />,
            loader: customShowsLoader(queryClient),
          },
          {
            path: '/library/fillers/new',
            element: <EditCustomShowPage isNew={true} />,
            loader: newCustomShowLoader(queryClient),
          },
          {
            path: '/library/fillers/:id/edit',
            element: <EditCustomShowPage isNew={false} />,
            loader: existingCustomShowLoader(queryClient),
          },
        ],
      },
    ],
  },
]);
