/* prettier-ignore-start */

/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file is auto-generated by TanStack Router

// Import Routes

import { Route as rootRoute } from './routes/__root'
import { Route as WelcomeImport } from './routes/welcome'
import { Route as SettingsImport } from './routes/settings'
import { Route as GuideImport } from './routes/guide'
import { Route as IndexImport } from './routes/index'
import { Route as LibraryIndexImport } from './routes/library/index'
import { Route as ChannelsIndexImport } from './routes/channels/index'
import { Route as SettingsXmltvImport } from './routes/settings/xmltv'
import { Route as SettingsTasksImport } from './routes/settings/tasks'
import { Route as SettingsPlexImport } from './routes/settings/plex'
import { Route as SettingsHdhrImport } from './routes/settings/hdhr'
import { Route as SettingsGeneralImport } from './routes/settings/general'
import { Route as SettingsFfmpegImport } from './routes/settings/ffmpeg'
import { Route as LibraryFillersImport } from './routes/library/fillers'
import { Route as LibraryCustomShowsImport } from './routes/library/custom-shows'
import { Route as ChannelsTestImport } from './routes/channels/test'
import { Route as ChannelsNewImport } from './routes/channels/new'
import { Route as ChannelsChannelIdImport } from './routes/channels/$channelId'
import { Route as LibraryIdEditImport } from './routes/library_/$id/edit'
import { Route as LibraryFillersNewImport } from './routes/library/fillers_.new'
import { Route as LibraryCustomShowsNewImport } from './routes/library/custom-shows_.new'
import { Route as ChannelsChannelIdWatchImport } from './routes/channels_/$channelId/watch'
import { Route as ChannelsChannelIdProgrammingIndexImport } from './routes/channels_/$channelId/programming/index'
import { Route as ChannelsChannelIdEditIndexImport } from './routes/channels_/$channelId/edit/index'
import { Route as LibraryFillersProgrammingAddImport } from './routes/library/fillers_.programming_.add'
import { Route as LibraryFillersFillerIdEditImport } from './routes/library/fillers_/$fillerId/edit'
import { Route as LibraryCustomShowsProgrammingAddImport } from './routes/library/custom-shows_.programming_.add'
import { Route as LibraryCustomShowsShowIdEditImport } from './routes/library/custom-shows_.$showId.edit'
import { Route as ChannelsChannelIdProgrammingTimeSlotEditorImport } from './routes/channels_/$channelId/programming/time-slot-editor'
import { Route as ChannelsChannelIdProgrammingRandomSlotEditorImport } from './routes/channels_/$channelId/programming/random-slot-editor'
import { Route as ChannelsChannelIdProgrammingAddImport } from './routes/channels_/$channelId/programming/add'

// Create/Update Routes

const WelcomeRoute = WelcomeImport.update({
  path: '/welcome',
  getParentRoute: () => rootRoute,
} as any)

const SettingsRoute = SettingsImport.update({
  path: '/settings',
  getParentRoute: () => rootRoute,
} as any)

const GuideRoute = GuideImport.update({
  path: '/guide',
  getParentRoute: () => rootRoute,
} as any)

const IndexRoute = IndexImport.update({
  path: '/',
  getParentRoute: () => rootRoute,
} as any)

const LibraryIndexRoute = LibraryIndexImport.update({
  path: '/library/',
  getParentRoute: () => rootRoute,
} as any)

const ChannelsIndexRoute = ChannelsIndexImport.update({
  path: '/channels/',
  getParentRoute: () => rootRoute,
} as any)

const SettingsXmltvRoute = SettingsXmltvImport.update({
  path: '/xmltv',
  getParentRoute: () => SettingsRoute,
} as any)

const SettingsTasksRoute = SettingsTasksImport.update({
  path: '/tasks',
  getParentRoute: () => SettingsRoute,
} as any)

const SettingsPlexRoute = SettingsPlexImport.update({
  path: '/plex',
  getParentRoute: () => SettingsRoute,
} as any)

const SettingsHdhrRoute = SettingsHdhrImport.update({
  path: '/hdhr',
  getParentRoute: () => SettingsRoute,
} as any)

const SettingsGeneralRoute = SettingsGeneralImport.update({
  path: '/general',
  getParentRoute: () => SettingsRoute,
} as any)

const SettingsFfmpegRoute = SettingsFfmpegImport.update({
  path: '/ffmpeg',
  getParentRoute: () => SettingsRoute,
} as any)

const LibraryFillersRoute = LibraryFillersImport.update({
  path: '/library/fillers',
  getParentRoute: () => rootRoute,
} as any)

const LibraryCustomShowsRoute = LibraryCustomShowsImport.update({
  path: '/library/custom-shows',
  getParentRoute: () => rootRoute,
} as any)

const ChannelsTestRoute = ChannelsTestImport.update({
  path: '/channels/test',
  getParentRoute: () => rootRoute,
} as any)

const ChannelsNewRoute = ChannelsNewImport.update({
  path: '/channels/new',
  getParentRoute: () => rootRoute,
} as any)

const ChannelsChannelIdRoute = ChannelsChannelIdImport.update({
  path: '/channels/$channelId',
  getParentRoute: () => rootRoute,
} as any)

const LibraryIdEditRoute = LibraryIdEditImport.update({
  path: '/library/$id/edit',
  getParentRoute: () => rootRoute,
} as any)

const LibraryFillersNewRoute = LibraryFillersNewImport.update({
  path: '/library/fillers/new',
  getParentRoute: () => rootRoute,
} as any)

const LibraryCustomShowsNewRoute = LibraryCustomShowsNewImport.update({
  path: '/library/custom-shows/new',
  getParentRoute: () => rootRoute,
} as any)

const ChannelsChannelIdWatchRoute = ChannelsChannelIdWatchImport.update({
  path: '/channels/$channelId/watch',
  getParentRoute: () => rootRoute,
} as any)

const ChannelsChannelIdProgrammingIndexRoute =
  ChannelsChannelIdProgrammingIndexImport.update({
    path: '/channels/$channelId/programming/',
    getParentRoute: () => rootRoute,
  } as any)

const ChannelsChannelIdEditIndexRoute = ChannelsChannelIdEditIndexImport.update(
  {
    path: '/channels/$channelId/edit/',
    getParentRoute: () => rootRoute,
  } as any,
)

const LibraryFillersProgrammingAddRoute =
  LibraryFillersProgrammingAddImport.update({
    path: '/library/fillers/programming/add',
    getParentRoute: () => rootRoute,
  } as any)

const LibraryFillersFillerIdEditRoute = LibraryFillersFillerIdEditImport.update(
  {
    path: '/library/fillers/$fillerId/edit',
    getParentRoute: () => rootRoute,
  } as any,
)

const LibraryCustomShowsProgrammingAddRoute =
  LibraryCustomShowsProgrammingAddImport.update({
    path: '/library/custom-shows/programming/add',
    getParentRoute: () => rootRoute,
  } as any)

const LibraryCustomShowsShowIdEditRoute =
  LibraryCustomShowsShowIdEditImport.update({
    path: '/library/custom-shows/$showId/edit',
    getParentRoute: () => rootRoute,
  } as any)

const ChannelsChannelIdProgrammingTimeSlotEditorRoute =
  ChannelsChannelIdProgrammingTimeSlotEditorImport.update({
    path: '/channels/$channelId/programming/time-slot-editor',
    getParentRoute: () => rootRoute,
  } as any)

const ChannelsChannelIdProgrammingRandomSlotEditorRoute =
  ChannelsChannelIdProgrammingRandomSlotEditorImport.update({
    path: '/channels/$channelId/programming/random-slot-editor',
    getParentRoute: () => rootRoute,
  } as any)

const ChannelsChannelIdProgrammingAddRoute =
  ChannelsChannelIdProgrammingAddImport.update({
    path: '/channels/$channelId/programming/add',
    getParentRoute: () => rootRoute,
  } as any)

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexImport
      parentRoute: typeof rootRoute
    }
    '/guide': {
      id: '/guide'
      path: '/guide'
      fullPath: '/guide'
      preLoaderRoute: typeof GuideImport
      parentRoute: typeof rootRoute
    }
    '/settings': {
      id: '/settings'
      path: '/settings'
      fullPath: '/settings'
      preLoaderRoute: typeof SettingsImport
      parentRoute: typeof rootRoute
    }
    '/welcome': {
      id: '/welcome'
      path: '/welcome'
      fullPath: '/welcome'
      preLoaderRoute: typeof WelcomeImport
      parentRoute: typeof rootRoute
    }
    '/channels/$channelId': {
      id: '/channels/$channelId'
      path: '/channels/$channelId'
      fullPath: '/channels/$channelId'
      preLoaderRoute: typeof ChannelsChannelIdImport
      parentRoute: typeof rootRoute
    }
    '/channels/new': {
      id: '/channels/new'
      path: '/channels/new'
      fullPath: '/channels/new'
      preLoaderRoute: typeof ChannelsNewImport
      parentRoute: typeof rootRoute
    }
    '/channels/test': {
      id: '/channels/test'
      path: '/channels/test'
      fullPath: '/channels/test'
      preLoaderRoute: typeof ChannelsTestImport
      parentRoute: typeof rootRoute
    }
    '/library/custom-shows': {
      id: '/library/custom-shows'
      path: '/library/custom-shows'
      fullPath: '/library/custom-shows'
      preLoaderRoute: typeof LibraryCustomShowsImport
      parentRoute: typeof rootRoute
    }
    '/library/fillers': {
      id: '/library/fillers'
      path: '/library/fillers'
      fullPath: '/library/fillers'
      preLoaderRoute: typeof LibraryFillersImport
      parentRoute: typeof rootRoute
    }
    '/settings/ffmpeg': {
      id: '/settings/ffmpeg'
      path: '/ffmpeg'
      fullPath: '/settings/ffmpeg'
      preLoaderRoute: typeof SettingsFfmpegImport
      parentRoute: typeof SettingsImport
    }
    '/settings/general': {
      id: '/settings/general'
      path: '/general'
      fullPath: '/settings/general'
      preLoaderRoute: typeof SettingsGeneralImport
      parentRoute: typeof SettingsImport
    }
    '/settings/hdhr': {
      id: '/settings/hdhr'
      path: '/hdhr'
      fullPath: '/settings/hdhr'
      preLoaderRoute: typeof SettingsHdhrImport
      parentRoute: typeof SettingsImport
    }
    '/settings/plex': {
      id: '/settings/plex'
      path: '/plex'
      fullPath: '/settings/plex'
      preLoaderRoute: typeof SettingsPlexImport
      parentRoute: typeof SettingsImport
    }
    '/settings/tasks': {
      id: '/settings/tasks'
      path: '/tasks'
      fullPath: '/settings/tasks'
      preLoaderRoute: typeof SettingsTasksImport
      parentRoute: typeof SettingsImport
    }
    '/settings/xmltv': {
      id: '/settings/xmltv'
      path: '/xmltv'
      fullPath: '/settings/xmltv'
      preLoaderRoute: typeof SettingsXmltvImport
      parentRoute: typeof SettingsImport
    }
    '/channels/': {
      id: '/channels/'
      path: '/channels'
      fullPath: '/channels'
      preLoaderRoute: typeof ChannelsIndexImport
      parentRoute: typeof rootRoute
    }
    '/library/': {
      id: '/library/'
      path: '/library'
      fullPath: '/library'
      preLoaderRoute: typeof LibraryIndexImport
      parentRoute: typeof rootRoute
    }
    '/channels/$channelId/watch': {
      id: '/channels/$channelId/watch'
      path: '/channels/$channelId/watch'
      fullPath: '/channels/$channelId/watch'
      preLoaderRoute: typeof ChannelsChannelIdWatchImport
      parentRoute: typeof rootRoute
    }
    '/library/custom-shows/new': {
      id: '/library/custom-shows/new'
      path: '/library/custom-shows/new'
      fullPath: '/library/custom-shows/new'
      preLoaderRoute: typeof LibraryCustomShowsNewImport
      parentRoute: typeof rootRoute
    }
    '/library/fillers/new': {
      id: '/library/fillers/new'
      path: '/library/fillers/new'
      fullPath: '/library/fillers/new'
      preLoaderRoute: typeof LibraryFillersNewImport
      parentRoute: typeof rootRoute
    }
    '/library/$id/edit': {
      id: '/library/$id/edit'
      path: '/library/$id/edit'
      fullPath: '/library/$id/edit'
      preLoaderRoute: typeof LibraryIdEditImport
      parentRoute: typeof rootRoute
    }
    '/channels/$channelId/programming/add': {
      id: '/channels/$channelId/programming/add'
      path: '/channels/$channelId/programming/add'
      fullPath: '/channels/$channelId/programming/add'
      preLoaderRoute: typeof ChannelsChannelIdProgrammingAddImport
      parentRoute: typeof rootRoute
    }
    '/channels/$channelId/programming/random-slot-editor': {
      id: '/channels/$channelId/programming/random-slot-editor'
      path: '/channels/$channelId/programming/random-slot-editor'
      fullPath: '/channels/$channelId/programming/random-slot-editor'
      preLoaderRoute: typeof ChannelsChannelIdProgrammingRandomSlotEditorImport
      parentRoute: typeof rootRoute
    }
    '/channels/$channelId/programming/time-slot-editor': {
      id: '/channels/$channelId/programming/time-slot-editor'
      path: '/channels/$channelId/programming/time-slot-editor'
      fullPath: '/channels/$channelId/programming/time-slot-editor'
      preLoaderRoute: typeof ChannelsChannelIdProgrammingTimeSlotEditorImport
      parentRoute: typeof rootRoute
    }
    '/library/custom-shows/$showId/edit': {
      id: '/library/custom-shows/$showId/edit'
      path: '/library/custom-shows/$showId/edit'
      fullPath: '/library/custom-shows/$showId/edit'
      preLoaderRoute: typeof LibraryCustomShowsShowIdEditImport
      parentRoute: typeof rootRoute
    }
    '/library/custom-shows/programming/add': {
      id: '/library/custom-shows/programming/add'
      path: '/library/custom-shows/programming/add'
      fullPath: '/library/custom-shows/programming/add'
      preLoaderRoute: typeof LibraryCustomShowsProgrammingAddImport
      parentRoute: typeof rootRoute
    }
    '/library/fillers/$fillerId/edit': {
      id: '/library/fillers/$fillerId/edit'
      path: '/library/fillers/$fillerId/edit'
      fullPath: '/library/fillers/$fillerId/edit'
      preLoaderRoute: typeof LibraryFillersFillerIdEditImport
      parentRoute: typeof rootRoute
    }
    '/library/fillers/programming/add': {
      id: '/library/fillers/programming/add'
      path: '/library/fillers/programming/add'
      fullPath: '/library/fillers/programming/add'
      preLoaderRoute: typeof LibraryFillersProgrammingAddImport
      parentRoute: typeof rootRoute
    }
    '/channels/$channelId/edit/': {
      id: '/channels/$channelId/edit/'
      path: '/channels/$channelId/edit'
      fullPath: '/channels/$channelId/edit'
      preLoaderRoute: typeof ChannelsChannelIdEditIndexImport
      parentRoute: typeof rootRoute
    }
    '/channels/$channelId/programming/': {
      id: '/channels/$channelId/programming/'
      path: '/channels/$channelId/programming'
      fullPath: '/channels/$channelId/programming'
      preLoaderRoute: typeof ChannelsChannelIdProgrammingIndexImport
      parentRoute: typeof rootRoute
    }
  }
}

// Create and export the route tree

export const routeTree = rootRoute.addChildren({
  IndexRoute,
  GuideRoute,
  SettingsRoute: SettingsRoute.addChildren({
    SettingsFfmpegRoute,
    SettingsGeneralRoute,
    SettingsHdhrRoute,
    SettingsPlexRoute,
    SettingsTasksRoute,
    SettingsXmltvRoute,
  }),
  WelcomeRoute,
  ChannelsChannelIdRoute,
  ChannelsNewRoute,
  ChannelsTestRoute,
  LibraryCustomShowsRoute,
  LibraryFillersRoute,
  ChannelsIndexRoute,
  LibraryIndexRoute,
  ChannelsChannelIdWatchRoute,
  LibraryCustomShowsNewRoute,
  LibraryFillersNewRoute,
  LibraryIdEditRoute,
  ChannelsChannelIdProgrammingAddRoute,
  ChannelsChannelIdProgrammingRandomSlotEditorRoute,
  ChannelsChannelIdProgrammingTimeSlotEditorRoute,
  LibraryCustomShowsShowIdEditRoute,
  LibraryCustomShowsProgrammingAddRoute,
  LibraryFillersFillerIdEditRoute,
  LibraryFillersProgrammingAddRoute,
  ChannelsChannelIdEditIndexRoute,
  ChannelsChannelIdProgrammingIndexRoute,
})

/* prettier-ignore-end */

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/guide",
        "/settings",
        "/welcome",
        "/channels/$channelId",
        "/channels/new",
        "/channels/test",
        "/library/custom-shows",
        "/library/fillers",
        "/channels/",
        "/library/",
        "/channels/$channelId/watch",
        "/library/custom-shows/new",
        "/library/fillers/new",
        "/library/$id/edit",
        "/channels/$channelId/programming/add",
        "/channels/$channelId/programming/random-slot-editor",
        "/channels/$channelId/programming/time-slot-editor",
        "/library/custom-shows/$showId/edit",
        "/library/custom-shows/programming/add",
        "/library/fillers/$fillerId/edit",
        "/library/fillers/programming/add",
        "/channels/$channelId/edit/",
        "/channels/$channelId/programming/"
      ]
    },
    "/": {
      "filePath": "index.tsx"
    },
    "/guide": {
      "filePath": "guide.tsx"
    },
    "/settings": {
      "filePath": "settings.tsx",
      "children": [
        "/settings/ffmpeg",
        "/settings/general",
        "/settings/hdhr",
        "/settings/plex",
        "/settings/tasks",
        "/settings/xmltv"
      ]
    },
    "/welcome": {
      "filePath": "welcome.tsx"
    },
    "/channels/$channelId": {
      "filePath": "channels/$channelId.tsx"
    },
    "/channels/new": {
      "filePath": "channels/new.tsx"
    },
    "/channels/test": {
      "filePath": "channels/test.tsx"
    },
    "/library/custom-shows": {
      "filePath": "library/custom-shows.tsx"
    },
    "/library/fillers": {
      "filePath": "library/fillers.tsx"
    },
    "/settings/ffmpeg": {
      "filePath": "settings/ffmpeg.tsx",
      "parent": "/settings"
    },
    "/settings/general": {
      "filePath": "settings/general.tsx",
      "parent": "/settings"
    },
    "/settings/hdhr": {
      "filePath": "settings/hdhr.tsx",
      "parent": "/settings"
    },
    "/settings/plex": {
      "filePath": "settings/plex.tsx",
      "parent": "/settings"
    },
    "/settings/tasks": {
      "filePath": "settings/tasks.tsx",
      "parent": "/settings"
    },
    "/settings/xmltv": {
      "filePath": "settings/xmltv.tsx",
      "parent": "/settings"
    },
    "/channels/": {
      "filePath": "channels/index.tsx"
    },
    "/library/": {
      "filePath": "library/index.tsx"
    },
    "/channels/$channelId/watch": {
      "filePath": "channels_/$channelId/watch.tsx"
    },
    "/library/custom-shows/new": {
      "filePath": "library/custom-shows_.new.tsx"
    },
    "/library/fillers/new": {
      "filePath": "library/fillers_.new.tsx"
    },
    "/library/$id/edit": {
      "filePath": "library_/$id/edit.tsx"
    },
    "/channels/$channelId/programming/add": {
      "filePath": "channels_/$channelId/programming/add.tsx"
    },
    "/channels/$channelId/programming/random-slot-editor": {
      "filePath": "channels_/$channelId/programming/random-slot-editor.tsx"
    },
    "/channels/$channelId/programming/time-slot-editor": {
      "filePath": "channels_/$channelId/programming/time-slot-editor.tsx"
    },
    "/library/custom-shows/$showId/edit": {
      "filePath": "library/custom-shows_.$showId.edit.tsx"
    },
    "/library/custom-shows/programming/add": {
      "filePath": "library/custom-shows_.programming_.add.tsx"
    },
    "/library/fillers/$fillerId/edit": {
      "filePath": "library/fillers_/$fillerId/edit.tsx"
    },
    "/library/fillers/programming/add": {
      "filePath": "library/fillers_.programming_.add.tsx"
    },
    "/channels/$channelId/edit/": {
      "filePath": "channels_/$channelId/edit/index.tsx"
    },
    "/channels/$channelId/programming/": {
      "filePath": "channels_/$channelId/programming/index.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
