import { z } from 'zod/v4';

export const FeatureFlagsSchema = z.object({
  proxyArtwork: z.boolean().default(false),
  tonemapEnabled: z.boolean().default(false),
  webvttSidecarEnabled: z.boolean().default(false),
  xmltvCreditImagesEnabled: z.boolean().default(false),
  disableSearchSnapshotInBackup: z.boolean().default(false),
  disableVulkan: z.boolean().default(false),
  disableVaapiPad: z.boolean().default(false),
});

export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type FeatureFlagKey = keyof FeatureFlags;

export type FeatureFlagMeta = {
  key: FeatureFlagKey;
  displayName: string;
  description: string;
  envVar: string;
  category: 'experimental' | 'escape-hatch';
};

export const FeatureFlagMetadata: FeatureFlagMeta[] = [
  {
    key: 'proxyArtwork',
    displayName: 'Proxy Artwork',
    description:
      'Route artwork requests through the Tunarr server instead of using direct media source URLs.',
    envVar: 'TUNARR_PROXY_ARTWORK',
    category: 'experimental',
  },
  {
    key: 'tonemapEnabled',
    displayName: 'HDR Tonemapping',
    description:
      'Enable HDR to SDR tonemapping during hardware-accelerated video transcoding.',
    envVar: 'TUNARR_TONEMAP_ENABLED',
    category: 'experimental',
  },
  {
    key: 'webvttSidecarEnabled',
    displayName: 'WebVTT Sidecar Subtitles',
    description:
      'Enable generation of WebVTT subtitle sidecar files during streaming.',
    envVar: 'TUNARR_WEBVTT_SIDECAR_ENABLED',
    category: 'experimental',
  },
  {
    key: 'xmltvCreditImagesEnabled',
    displayName: 'XMLTV Credit Images',
    description:
      'Enable embedding images of people in the xmltv credit elements. (must regenerate xmltv to take effect)',
    envVar: 'TUNARR_XMLTV_CREDIT_IMAGES_ENABLED',
    category: 'experimental',
  },
  {
    key: 'disableSearchSnapshotInBackup',
    displayName: 'Disable Search Snapshot in Backup',
    description:
      'Skip including the Meilisearch search snapshot when creating database backups.',
    envVar: 'TUNARR_DISABLE_SEARCH_SNAPSHOT_IN_BACKUP',
    category: 'escape-hatch',
  },
  {
    key: 'disableVulkan',
    displayName: 'Disable Vulkan (NVIDIA)',
    description:
      'Disable Vulkan-based processing in the NVIDIA hardware acceleration pipeline.',
    envVar: 'TUNARR_DISABLE_VULKAN',
    category: 'escape-hatch',
  },
  {
    key: 'disableVaapiPad',
    displayName: 'Disable VAAPI Pad',
    description:
      'Disable hardware-accelerated padding in the VAAPI video pipeline.',
    envVar: 'TUNARR_DISABLE_VAAPI_PAD',
    category: 'escape-hatch',
  },
];
