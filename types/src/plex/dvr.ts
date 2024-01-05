export interface PlexDvrsResponse {
  size: number;
  Dvr: PlexDvr[];
}

export interface PlexDvr {
  key: string;
  uuid: string;
  language: string;
  lineupTitle: string;
  lineup: string;
  country: string;
  refreshedAt: number;
  epgIdentifier: string;
  Device: PlexDvrDevice[];
  Lineup: PlexDvrLineup[];
  Setting: PlexDvrSettings[];
}

export interface PlexDvrDevice {
  parentID: number;
  key: string;
  uuid: string;
  uri: string;
  protocol: string;
  status: string;
  state: string;
  lastSeenAt: number;
  canTranscode: string;
  deviceId: string;
  make: string;
  model: string;
  modelNumber: string;
  source: string;
  sources: string;
  thumb: string;
  title: string;
  tuners: string;
  ChannelMapping: PlexDvrChannelMapping[];
  Setting: PlexDvrDeviceSettings[];
}

export interface PlexDvrChannelMapping {
  channelKey: string;
  deviceIdentifier: string;
  enabled: string;
  lineupIdentifier: string;
}

export interface PlexDvrDeviceSettings {
  id: string;
  label: string;
  summary: string;
  type: string;
  default: string;
  value: string;
  hidden: boolean;
  advanced: boolean;
  group: string;
  enumValues: string;
}

export interface PlexDvrLineup {
  id: string;
  title: string;
}

export interface PlexDvrSettings {
  id: string;
  label: string;
  summary: string;
  type: string;
  default: string;
  value: string;
  hidden: boolean;
  advanced: boolean;
  group: string;
  enumValues?: string;
}
