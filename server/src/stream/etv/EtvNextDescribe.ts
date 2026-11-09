import { ChannelConfigVersion } from './EtvNextChannelConfigMapper.ts';
import { EtvNextOutputFiles } from './EtvNextPlaylistCreator.ts';
import { PlayoutVersion } from './EtvNextWorkspace.ts';
import type { Describe, SchemaInfo } from './generated/describe.ts';
import { DescribeSchema } from './generated/describe.ts';

/**
 * The `describe_version` this build reads. Upstream bumps it when a field is
 * removed, renamed or changes meaning, so any other value is unreadable.
 */
export const DescribeVersion = 1;

/** The dynamic callback headers `etvApi` reads. */
export const RequiredCallbackHeaders = [
  'x-etv-channel',
  'x-etv-now',
  'x-etv-until',
] as const;

/**
 * Parses `ersatztv-channel describe` output.
 *
 * @throws when the output is not JSON or does not match the schema.
 */
export function parseDescribe(stdout: string): Describe {
  return DescribeSchema.parse(JSON.parse(stdout));
}

/**
 * Whether a worker that reports `accepted` loads a document written at
 * `version`.
 *
 * Mirrors upstream's `VersionedSchema::check`. A version URI is a prefix
 * followed by `0.<breaking>.<compatible>`. The prefix and breaking digit must
 * match, and the compatible digit must not be newer than the worker's.
 */
export function acceptsSchemaVersion(
  accepted: SchemaInfo,
  version: string,
): boolean {
  const newest = splitVersionUri(accepted.uri);
  const written = splitVersionUri(version);
  if (!newest || !written) {
    return false;
  }

  return (
    written.prefix === newest.prefix &&
    written.breaking === accepted.breaking &&
    written.compatible <= accepted.compatible
  );
}

function splitVersionUri(uri: string) {
  const match = /^(.*)0\.(\d+)\.(\d+)$/.exec(uri);
  if (!match) {
    return;
  }

  const [, prefix, breaking, compatible] = match;
  return {
    prefix,
    breaking: Number(breaking),
    compatible: Number(compatible),
  };
}

/**
 * Lists every way the worker's contract differs from what Tunarr writes and
 * reads. An empty list means the worker can run Tunarr's channels.
 */
export function findContractMismatches(describe: Describe): string[] {
  if (describe.describe_version !== DescribeVersion) {
    return [
      `describe_version is ${describe.describe_version}, but Tunarr reads ${DescribeVersion}`,
    ];
  }

  const { contract } = describe;
  const mismatches: string[] = [];

  if (!acceptsSchemaVersion(contract.playout_schema, PlayoutVersion)) {
    mismatches.push(
      `playout schema: Tunarr writes ${PlayoutVersion}, the worker accepts up to ${contract.playout_schema.uri}`,
    );
  }

  if (
    !acceptsSchemaVersion(contract.channel_config_schema, ChannelConfigVersion)
  ) {
    mismatches.push(
      `channel config schema: Tunarr writes ${ChannelConfigVersion}, the worker accepts up to ${contract.channel_config_schema.uri}`,
    );
  }

  const files = [
    [
      'playlist',
      contract.output_files.playlist,
      EtvNextOutputFiles.MediaPlaylist,
    ],
    [
      'subtitle_playlist',
      contract.output_files.subtitle_playlist,
      EtvNextOutputFiles.SubtitlePlaylist,
    ],
    ['ready', contract.output_files.ready, EtvNextOutputFiles.ReadyFile],
    [
      'heartbeat',
      contract.output_files.heartbeat,
      EtvNextOutputFiles.HeartbeatFile,
    ],
  ] as const;
  for (const [name, actual, expected] of files) {
    if (actual !== expected) {
      mismatches.push(
        `output file ${name}: the worker writes ${actual}, Tunarr expects ${expected}`,
      );
    }
  }

  for (const header of RequiredCallbackHeaders) {
    if (!contract.dynamic_callback_headers.includes(header)) {
      mismatches.push(`dynamic callbacks no longer send ${header}`);
    }
  }

  return mismatches;
}
