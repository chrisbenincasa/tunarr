#!/usr/bin/env node
// Boots an isolated Tunarr server, streams one channel for a bounded window,
// and reports tracks, A/V start offsets, timestamp continuity, and the ffmpeg
// commands the server ran. See ../SKILL.md for usage.

import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';

const { values: opt } = parseArgs({
  options: {
    source: { type: 'string', default: 'synthetic' },
    layout: { type: 'string', default: 'basic' },
    clips: { type: 'string', default: '3' },
    'clip-seconds': { type: 'string', default: '60' },
    'clip-durations': { type: 'string' },
    'truncate-clip': { type: 'string' },
    'mid-truncate': { type: 'string' },
    'start-ago': { type: 'string' },
    'db-dir': { type: 'string' },
    channel: { type: 'string' },
    mode: { type: 'string', default: 'hls' },
    seconds: { type: 'string', default: '60' },
    out: { type: 'string' },
    ffmpeg: { type: 'string', default: 'ffmpeg' },
    ffprobe: { type: 'string', default: 'ffprobe' },
    'keep-server': { type: 'boolean', default: false },
    rewind: { type: 'string' },
    'rewind-polls': { type: 'string', default: '8' },
    reanalyze: { type: 'string' },
    'flex-first': { type: 'string' },
    'ffmpeg-setting': { type: 'string', multiple: true, default: [] },
    resolution: { type: 'string' },
    schedule: { type: 'string' },
  },
});

// The script lives inside the repo; fall back to cwd when run from a copy elsewhere.
function findRepoRoot() {
  for (const cwd of [import.meta.dirname, process.cwd()]) {
    try {
      const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (fs.existsSync(path.join(root, 'server/src/index.ts'))) return root;
    } catch {}
  }
  throw new Error('run this from inside the Tunarr repo');
}
const repoRoot = findRepoRoot();
const serverDir = path.join(repoRoot, 'server');
const out = path.resolve(
  opt.reanalyze ?? opt.out ?? fs.mkdtempSync(path.join(os.tmpdir(), 'tunarr-repro-')),
);
fs.mkdirSync(out, { recursive: true });
const dbDir = path.join(out, 'db');
const seconds = Number(opt.seconds);
// Per-clip lengths in seconds, e.g. "60,8,60" for a bumper between two programs.
const clipDurations = opt['clip-durations']
  ? opt['clip-durations'].split(',').map(Number)
  : Array.from({ length: Number(opt.clips) }, () => Number(opt['clip-seconds']));
if (clipDurations.some((d) => !(d > 0))) throw new Error('--clip-durations must be positive seconds, comma separated');
const flexMs = opt['flex-first'] === undefined ? 0 : Number(opt['flex-first']);
if (!(flexMs >= 0)) throw new Error('--flex-first takes milliseconds');
if (flexMs > 0 && opt.source !== 'synthetic') throw new Error('--flex-first only works with --source synthetic');
const resolutionMatch = opt.resolution === undefined ? null : /^(\d+)x(\d+)$/.exec(opt.resolution);
if (opt.resolution !== undefined && !resolutionMatch) throw new Error('--resolution takes WIDTHxHEIGHT, such as 1280x720');
const resolution = resolutionMatch && { widthPx: Number(resolutionMatch[1]), heightPx: Number(resolutionMatch[2]) };
const log = (...a) => console.error('[repro]', ...a);

// ---------- helpers ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Thrown by --seconds 0 to end the run after setup without counting as a failure.
class SkipCapture extends Error {}

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });
}

async function api(base, method, route, body) {
  const res = await fetch(base + route, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// /api/channels/:id only takes a uuid, so a channel number is resolved from the list.
async function findChannel(base, numberOrId) {
  if (!/^\d+$/.test(numberOrId)) return api(base, 'GET', `/api/channels/${numberOrId}`);
  const channels = await api(base, 'GET', '/api/channels');
  const ch = channels.find((c) => c.number === Number(numberOrId));
  if (!ch) throw new Error(`no channel with number ${numberOrId}`);
  return ch;
}

async function until(label, fn, timeoutMs, everyMs = 1000) {
  const end = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < end) {
    try {
      const v = await fn();
      if (v) return v;
    } catch (e) {
      lastErr = e;
    }
    await sleep(everyMs);
  }
  throw new Error(`timed out waiting for ${label}${lastErr ? `: ${lastErr.message}` : ''}`);
}

function ffprobeJson(file) {
  const raw = execFileSync(
    opt.ffprobe,
    [
      '-v', 'error',
      '-show_entries',
      'stream=index,codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels:stream_tags=language:stream_disposition=default',
      '-show_entries', 'packet=stream_index,pts_time,duration_time',
      '-of', 'json',
      file,
    ],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  return JSON.parse(raw);
}

// ---------- synthetic media ----------

const LAYOUTS = {
  basic: () => ({ size: '1280x720', rate: '30', audio: [{ lang: 'eng', ar: 48000, ac: 2 }], subs: false }),
  'multi-audio': () => ({
    size: '1280x720', rate: '30',
    audio: [{ lang: 'eng', ar: 48000, ac: 2 }, { lang: 'spa', ar: 48000, ac: 2 }],
    subs: false,
  }),
  'dup-lang': () => ({
    size: '1280x720', rate: '30',
    audio: [{ lang: 'eng', ar: 48000, ac: 2 }, { lang: 'eng', ar: 48000, ac: 2, title: 'Commentary' }],
    subs: false,
  }),
  subs: () => ({ size: '1280x720', rate: '30', audio: [{ lang: 'eng', ar: 48000, ac: 2 }], subs: true }),
  mixed: (i) =>
    [
      { size: '1280x720', rate: '30', audio: [{ lang: 'eng', ar: 48000, ac: 2 }], subs: false },
      { size: '1920x1080', rate: '24000/1001', audio: [{ lang: 'eng', ar: 44100, ac: 6 }], subs: true },
      { size: '720x480', rate: '30000/1001', audio: [{ lang: 'eng', ar: 48000, ac: 2 }, { lang: 'jpn', ar: 48000, ac: 2 }], subs: false },
    ][i % 3],
};

function makeClips(dir) {
  const layout = LAYOUTS[opt.layout];
  if (!layout) throw new Error(`unknown --layout ${opt.layout}; use ${Object.keys(LAYOUTS).join(', ')}`);
  fs.mkdirSync(dir, { recursive: true });
  const clips = [];
  for (let i = 0; i < clipDurations.length; i++) {
    const dur = clipDurations[i];
    const l = layout(i);
    const file = path.join(dir, `clip${String(i + 1).padStart(2, '0')}.mkv`);
    const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${l.size}:rate=${l.rate}`];
    l.audio.forEach((a, j) =>
      args.push('-f', 'lavfi', '-i', `sine=frequency=${440 + 220 * j}:sample_rate=${a.ar}`),
    );
    let subIdx;
    if (l.subs) {
      const srt = path.join(dir, `clip${i + 1}.srt`);
      fs.writeFileSync(
        srt,
        Array.from({ length: Math.ceil(dur / 2) }, (_, k) =>
          `${k + 1}\n00:00:${String(k * 2).padStart(2, '0')},000 --> 00:00:${String(k * 2 + 1).padStart(2, '0')},500\nclip ${i + 1} line ${k + 1}\n`,
        ).join('\n'),
      );
      subIdx = l.audio.length + 1;
      args.push('-i', srt);
    }
    args.push('-map', '0:v');
    l.audio.forEach((_, j) => args.push('-map', `${j + 1}:a`));
    if (subIdx) args.push('-map', `${subIdx}:s`, '-c:s', 'srt', '-metadata:s:s:0', 'language=eng');
    args.push('-t', String(dur), '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac');
    l.audio.forEach((a, j) =>
      args.push(`-ac:a:${j}`, String(a.ac), `-metadata:s:a:${j}`, `language=${a.lang}`, ...(a.title ? [`-metadata:s:a:${j}`, `title=${a.title}`] : [])),
    );
    args.push(file);
    execFileSync(opt.ffmpeg, args);
    clips.push({ file: path.basename(file), layout: l });
  }
  return clips;
}

// Shortens clip I (1-based) to S seconds after the scan, so the database keeps
// the longer duration. This mimics media that ends before its scheduled time.
function truncateClip(dir, spec) {
  const [i, s] = spec.split(':').map(Number);
  if (!(i >= 1 && i <= clipDurations.length && s > 0)) throw new Error('--truncate-clip takes I:S, a 1-based clip index and seconds');
  const file = path.join(dir, `clip${String(i).padStart(2, '0')}.mkv`);
  const tmp = `${file}.tmp.mkv`;
  execFileSync(opt.ffmpeg, ['-y', '-v', 'error', '-i', file, '-t', String(s), '-map', '0', '-c', 'copy', tmp]);
  fs.renameSync(tmp, file);
  log(`truncated clip ${i} to ${s}s; the database still says ${clipDurations[i - 1]}s`);
}

// Parses --mid-truncate I:S@T. At T seconds into the capture, clip I is cut to
// S seconds and the media source is rescanned, the way a replaced file and a
// scheduled scan would change a live channel.
function parseMidTruncate(spec) {
  const m = /^(\d+):(\d+(?:\.\d+)?)@(\d+(?:\.\d+)?)$/.exec(spec ?? '');
  if (!m) throw new Error('--mid-truncate takes I:S@T, such as 3:30@20');
  return { clip: `${m[1]}:${m[2]}`, atMs: Number(m[3]) * 1000 };
}

async function midTruncate(base, channel, clipsDir, spec, t0) {
  const before = await api(base, 'GET', `/api/channels/${channel.channelId}`);
  truncateClip(clipsDir, spec.clip);
  const scanAt = Date.now() - t0;
  await api(base, 'POST', `/api/media-sources/${channel.sourceId}/libraries/all/scan?forceScan=true`);
  await until(
    'rescan',
    async () => ((await api(base, 'GET', `/api/media-sources/${channel.sourceId}/all/status`)).state === 'not_scanning' ? true : null),
    120_000,
    500,
  );
  const scanDoneAt = Date.now() - t0;
  // The reconcile task runs right after the scan; give it a moment to write.
  const after = await until(
    'reconcile',
    async () => {
      const ch = await api(base, 'GET', `/api/channels/${channel.channelId}`);
      return ch.duration !== before.duration ? ch : null;
    },
    30_000,
    500,
  ).catch(() => null);
  const result = {
    clip: spec.clip,
    scanAtMs: scanAt,
    scanDoneAtMs: scanDoneAt,
    reconciledAtMs: after ? Date.now() - t0 : null,
    before: { startTime: before.startTime, duration: before.duration },
    after: after ? { startTime: after.startTime, duration: after.duration } : null,
  };
  log('mid-truncate', JSON.stringify(result));
  return result;
}

// ---------- server ----------

function prepareDbCopy() {
  if (!opt['db-dir']) throw new Error('--source copy needs --db-dir <tunarr database directory>');
  fs.cpSync(path.resolve(opt['db-dir']), dbDir, {
    recursive: true,
    filter: (p) => !/[\\/](logs|backups|cache|streams)$/.test(p),
  });

  // The copied settings hold absolute paths to the original directory.
  const settingsFile = path.join(dbDir, 'settings.json');
  if (fs.existsSync(settingsFile)) {
    const s = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    if (s.system?.logging) s.system.logging.logsDirectory = path.join(dbDir, 'logs');
    fs.writeFileSync(settingsFile, JSON.stringify(s, null, 2));
  }
}

async function startServer() {
  const port = await freePort();
  const searchPort = await freePort();
  const logFile = fs.openSync(path.join(out, 'server.stdout.log'), 'w');
  const child = spawn(
    path.join(serverDir, 'node_modules/.bin/tsx'),
    ['--tsconfig', './tsconfig.build.json', './src/index.ts'],
    {
      cwd: serverDir,
      detached: true,
      stdio: ['ignore', logFile, logFile],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        TUNARR_DATABASE_PATH: dbDir,
        TUNARR_SERVER_PORT: String(port),
        TUNARR_SEARCH_PORT: String(searchPort),
        TUNARR_BIND_ADDR: '127.0.0.1',
        TUNARR_LOG_LEVEL: 'debug',

        // Eight tsx-compiled workers boot for ~20s and starve ffmpeg of CPU,
        // which makes HLS startup time out. Streaming does not use them.
        TUNARR_USE_WORKER_POOL: 'false',
      },
    },
  );
  const stop = () => {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
  };
  process.on('exit', () => !opt['keep-server'] && stop());
  const base = `http://127.0.0.1:${port}`;
  await until('server ready', async () => (await fetch(`${base}/api/channels`)).ok, 180_000);
  return { base, stop, pid: child.pid };
}

async function buildSyntheticChannel(base, clipsDir) {
  const { id: sourceId } = await api(base, 'POST', '/api/media-sources', {
    type: 'local',
    name: 'repro-media',
    mediaType: 'other_videos',
    paths: [clipsDir],
    pathReplacements: [],
  });
  const source = await until(
    'library scan',
    async () => {
      const st = await api(base, 'GET', `/api/media-sources/${sourceId}/all/status`);
      if (st.state !== 'not_scanning') return null;
      const src = await api(base, 'GET', `/api/media-sources/${sourceId}`);
      return src.libraries.length > 0 && src.libraries.every((l) => l.lastScannedAt) ? src : null;
    },
    180_000,
    1500,
  );
  const programs = (
    await api(base, 'GET', `/api/media-libraries/${source.libraries[0].id}/programs`)
  ).sort((a, b) => String(a.program?.title).localeCompare(String(b.program?.title)));
  if (programs.length === 0) throw new Error('scan finished but found no programs');

  const configs = await api(base, 'GET', '/api/transcode_configs');
  const tc = configs.find((c) => c.isDefault) ?? configs[0];
  await applyResolution(base, tc.id);
  // --start-ago backdates the channel so it has already looped its lineup.
  const startTime = Date.now() - Number(opt['start-ago'] ?? 0) * 1000;
  const channel = await api(base, 'POST', '/api/channels', {
    type: 'new',
    channel: {
      id: '00000000-0000-0000-0000-000000000000',
      number: 900,
      name: 'Repro',
      groupTitle: 'tunarr',
      startTime,
      duration: 0,
      guideMinimumDuration: 30000,
      disableFillerOverlay: false,
      stealth: false,
      subtitlesEnabled: true,
      streamMode: opt.mode === 'mpegts' ? 'mpegts' : opt.mode,
      transcodeConfigId: tc.id,
      icon: {},
      offline: { mode: 'pic' },
    },
  });
  await api(base, 'POST', `/api/channels/${channel.id}/programming`, {
    type: 'manual',
    append: false,
    lineup: [
      ...(flexMs ? [{ type: 'flex', duration: flexMs }] : []),
      ...programs.map((p) => ({ type: 'content', id: p.id, duration: p.duration })),
    ],
  });
  return {
    channelId: channel.id,
    sourceId,
    startTime,
    programs: programs.map((p) => ({ id: p.id, title: p.program?.title, durationMs: p.duration })),
    lineup: [
      ...(flexMs ? [{ title: '(flex)', durationMs: flexMs }] : []),
      ...programs.map((p) => ({ title: p.program?.title, durationMs: p.duration })),
    ],
  };
}

async function applyResolution(base, transcodeConfigId) {
  if (!resolution) return;
  const tc = await api(base, 'GET', `/api/transcode_configs/${transcodeConfigId}`);
  await api(base, 'PUT', `/api/transcode_configs/${transcodeConfigId}`, { ...tc, resolution });
}

// Values parse as JSON when they can (true, 3, "x"), and as plain strings otherwise.
async function applyFfmpegSettings(base) {
  if (opt['ffmpeg-setting'].length === 0) return undefined;
  const overrides = {};
  for (const kv of opt['ffmpeg-setting']) {
    const eq = kv.indexOf('=');
    if (eq < 1) throw new Error(`--ffmpeg-setting needs key=value, got ${kv}`);
    const raw = kv.slice(eq + 1);
    let value;
    try {
      value = JSON.parse(raw);
    } catch {
      value = raw;
    }
    overrides[kv.slice(0, eq)] = value;
  }
  const current = await api(base, 'GET', '/api/ffmpeg-settings');
  await api(base, 'PUT', '/api/ffmpeg-settings', { ...current, ...overrides });

  // The schema strips unknown keys, so a misspelled key would otherwise pass silently.
  const saved = await api(base, 'GET', '/api/ffmpeg-settings');
  const ignored = Object.keys(overrides).filter((k) => JSON.stringify(saved[k]) !== JSON.stringify(overrides[k]));
  if (ignored.length) throw new Error(`ffmpeg settings not applied: ${ignored.join(', ')}`);
  return overrides;
}

// ---------- slot schedules ----------

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const HOUR_MS = 60 * 60 * 1000;

// Slot start times are offsets into the period, counted from Sunday 00:00 for
// a weekly schedule. "Sat 20:30" is weekly, "20:30" is daily, a number is raw ms.
function slotOffsetMs(at, period) {
  if (typeof at === 'number') return at;
  const m = /^(?:([a-z]{3})\w*\s+)?(\d{1,2}):(\d{2})$/i.exec(String(at).trim());
  if (!m) throw new Error(`slot time "${at}" must look like "Sat 20:30", "20:30", or a number of ms`);
  const day = m[1] ? DAYS.indexOf(m[1].toLowerCase()) : -1;
  if (m[1] && day < 0) throw new Error(`unknown weekday in "${at}"`);
  if (period === 'week' && day < 0) throw new Error(`weekly slot "${at}" needs a weekday`);
  if (period !== 'week' && day >= 0) throw new Error(`slot "${at}" has a weekday but the period is ${period}`);
  return Math.max(day, 0) * 24 * HOUR_MS + Number(m[2]) * HOUR_MS + Number(m[3]) * 60_000;
}

// Guide window bounds: "Sat 17:00" is the next such local time from now,
// anything else goes through Date.parse.
function wallClockMs(at) {
  const m = /^([a-z]{3})\w*\s+(\d{1,2}):(\d{2})$/i.exec(String(at).trim());
  if (!m) {
    const t = Date.parse(at);
    if (Number.isNaN(t)) throw new Error(`guide time "${at}" must look like "Sat 17:00" or an ISO date`);
    return t;
  }
  const day = DAYS.indexOf(m[1].toLowerCase());
  if (day < 0) throw new Error(`unknown weekday in "${at}"`);
  const d = new Date();
  d.setHours(Number(m[2]), Number(m[3]), 0, 0);
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 7);
  return d.getTime();
}

function localTime(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${DAYS[d.getDay()][0].toUpperCase()}${DAYS[d.getDay()].slice(1)} ${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function buildSlot(spec, period, showIds, channelIds) {
  const { at, customShow, redirect, flex, ...rest } = spec;
  const base = { id: crypto.randomUUID(), startTime: slotOffsetMs(at, period), ...rest };
  if (customShow !== undefined) {
    const customShowId = showIds[customShow];
    if (!customShowId) throw new Error(`slot at ${at}: no custom show named ${customShow}`);
    return { type: 'custom-show', customShowId, order: 'next', direction: 'asc', ...base };
  }
  if (redirect !== undefined) {
    const channelId = channelIds[redirect];
    if (!channelId) throw new Error(`slot at ${at}: no channel named ${redirect}`);
    return { type: 'redirect', channelId, ...base };
  }
  if (flex) return { type: 'flex', ...base };
  if (rest.type) return base;
  throw new Error(`slot at ${at} needs customShow, redirect, flex, or a raw type`);
}

// Builds custom shows and time-slot channels from a --schedule spec, then
// records each channel's saved lineup and, when asked, its guide window.
async function applySchedule(base, channel, specFile) {
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  if (!spec.channels?.length) throw new Error('--schedule needs a non-empty "channels" list');
  const clipPrograms = channel.programs;
  const titles = Object.fromEntries(clipPrograms.map((p) => [p.id, p.title]));

  const showIds = {};
  for (const [name, clips] of Object.entries(spec.customShows ?? {})) {
    const programs = clips.map((i) => {
      const p = clipPrograms[i - 1];
      if (!p) throw new Error(`custom show ${name}: no clip ${i} (there are ${clipPrograms.length})`);
      return { type: 'content', id: p.id, duration: p.durationMs, persisted: true };
    });
    const show = await api(base, 'POST', '/api/custom-shows', {
      name, programs, syncMediaSourceId: null, syncMediaSourceType: null, syncExternalPlaylistId: null,
    });
    showIds[name] = show.id;
  }

  // The first channel reuses the capture channel; the rest are copies of it.
  // Every channel exists before any schedule is saved, so redirects can point anywhere.
  const channelIds = {};
  for (const [i, c] of spec.channels.entries()) {
    channelIds[c.name] =
      i === 0 ? channel.channelId : (await api(base, 'POST', '/api/channels', { type: 'copy', channelId: channel.channelId })).id;
  }

  const allProgramIds = clipPrograms.map((p) => p.id);
  const result = { customShows: showIds, channels: [] };
  for (const c of spec.channels) {
    const period = c.period ?? 'day';
    const schedule = {
      type: 'time',
      flexPreference: 'distribute',
      maxDays: 14,
      padMs: 1,
      latenessMs: 0,
      overflow: { type: 'duration', maxMs: 0 },
      timeZoneOffset: new Date().getTimezoneOffset(),
      ...c.settings,
      period,
      slots: c.slots.map((s) => buildSlot(s, period, showIds, channelIds)),
    };
    await api(base, 'POST', `/api/channels/${channelIds[c.name]}/programming`, { type: 'time', programs: allProgramIds, schedule });
  }

  for (const c of spec.channels) {
    const id = channelIds[c.name];
    const ch = await api(base, 'GET', `/api/channels/${id}`);
    const { lineup } = await api(base, 'GET', `/api/channels/${id}/programming`);
    let t = ch.startTime;
    const items = [];
    for (const item of lineup) {
      const programId = item.id ?? item.programId;
      items.push({
        start: localTime(t),
        type: item.type,
        ...(programId && titles[programId] ? { title: titles[programId] } : {}),
        ...(item.type === 'redirect' ? { to: Object.keys(channelIds).find((n) => channelIds[n] === item.channel) } : {}),
        minutes: +(item.duration / 60_000).toFixed(2),
      });
      t += item.duration;
    }
    result.channels.push({ name: c.name, id, startTime: localTime(ch.startTime), lineup: items });
  }

  if (spec.guide) {
    const from = wallClockMs(spec.guide.from);
    const to = wallClockMs(spec.guide.to);
    if (!(to > from)) throw new Error('guide.to must come after guide.from');

    // The guide only builds programmingHours ahead, 12 by default.
    const xmltv = await api(base, 'GET', '/api/xmltv-settings');
    const needHours = Math.ceil((to - Date.now()) / HOUR_MS) + 1;
    if (xmltv.programmingHours < needHours) {
      await api(base, 'PUT', '/api/xmltv-settings', { ...xmltv, programmingHours: needHours });
    }
    await api(base, 'POST', '/api/tasks/UpdateXmlTvTask/run');

    const range = `dateFrom=${new Date(from).toISOString()}&dateTo=${new Date(to).toISOString()}`;
    result.guide = { from: localTime(from), to: localTime(to), channels: [] };
    for (const c of spec.channels) {
      const id = channelIds[c.name];
      const entries = await until(
        `guide for ${c.name}`,
        async () => {
          const g = await api(base, 'GET', `/api/guide/channels/${id}?${range}`);
          const last = g.at(-1);
          return last && last.startTimeMs + last.lineupItem.durationMs >= to ? g : null;
        },
        60_000,
        1000,
      );
      result.guide.channels.push({
        name: c.name,
        entries: entries.map((e) => ({
          start: localTime(e.startTimeMs),
          end: localTime(e.startTimeMs + e.lineupItem.durationMs),
          type: e.lineupItem.type,
          ...(e.lineupItem.id && titles[e.lineupItem.id] ? { title: titles[e.lineupItem.id] } : {}),
          ...(e.redirectChannelId ? { via: Object.keys(channelIds).find((n) => channelIds[n] === e.redirectChannelId) } : {}),
        })),
      });
    }
  }
  return result;
}

// ---------- capture ----------

async function captureTs(base, channelId) {
  const file = path.join(out, 'capture.ts');
  const ctl = new AbortController();
  const t0 = Date.now();
  const res = await fetch(`${base}/stream/channels/${channelId}.ts?streamMode=mpegts`, { signal: ctl.signal });
  if (!res.ok) throw new Error(`.ts stream -> ${res.status}`);
  const fh = fs.openSync(file, 'w');
  setTimeout(() => ctl.abort(), seconds * 1000);
  try {
    for await (const chunk of res.body) fs.writeSync(fh, chunk);
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
  }
  fs.closeSync(fh);
  return { t0, pieces: [{ file, discontinuityBefore: false }] };
}

function hlsListUrl(base, channelId) {
  const sessionType = opt.mode === 'hls_slower' ? 'hls_slower' : opt.mode === 'hls_direct_v2' ? 'hls_direct_v2' : 'hls';
  return `${base}/stream/channels/${channelId}/${sessionType}/stream.m3u8`;
}

const SEGMENT_NUMBER = /(\d+)(\.(?:ts|mp4|m4s))$/;

// Rewrites a segment URL to another segment number, keeping the zero padding.
function segmentUrlAt(url, number) {
  const u = new URL(url);
  u.pathname = u.pathname.replace(SEGMENT_NUMBER, (_, digits, ext) => String(number).padStart(digits.length, '0') + ext);
  return u.toString();
}

function segmentNumber(url) {
  const m = new URL(url).pathname.match(SEGMENT_NUMBER);
  return m ? Number(m[1]) : undefined;
}

// Acts as the capture client jumping back N segments, then playing on the way
// a player does. It polls the playlist and fetches each newly listed segment
// once, in order. A listed segment that 404s means the playlist points at a
// file that pruning deleted.
async function rewindHls(base, channelId, seen) {
  const n = Number(opt.rewind);
  const polls = Number(opt['rewind-polls']);
  const listUrl = hlsListUrl(base, channelId);
  const urls = [...seen].map((l) => new URL(l, listUrl).toString()).filter((u) => segmentNumber(u) !== undefined);
  if (urls.length === 0) throw new Error('--rewind: the capture saw no numbered segments');
  const last = urls.reduce((a, b) => (segmentNumber(b) > segmentNumber(a) ? b : a));
  const from = segmentNumber(last);
  const target = Math.max(0, from - n);
  const targetUrl = segmentUrlAt(last, target);
  const targetStatus = (await fetch(targetUrl)).status;

  const fetched = new Map();
  const results = [];
  for (let i = 0; i < polls; i++) {
    await sleep(2000);
    const res = await fetch(listUrl);
    if (!res.ok) {
      results.push({ poll: i, playlistStatus: res.status });
      continue;
    }
    const text = await res.text();
    const listed = text
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => new URL(l, listUrl).toString());
    const missing = [];
    for (const url of listed) {
      if (!fetched.has(url)) fetched.set(url, (await fetch(url)).status);
      if (fetched.get(url) === 404) missing.push(path.basename(new URL(url).pathname));
    }
    const numbers = listed.map(segmentNumber).filter((x) => x !== undefined);
    results.push({
      poll: i,
      mediaSequence: Number(text.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/)?.[1]),
      firstListed: numbers.length ? Math.min(...numbers) : null,
      lastListed: numbers.length ? Math.max(...numbers) : null,
      listed: listed.length,
      missing,
    });
  }

  const segment404s = [...fetched.values()].filter((s) => s === 404).length;
  return { n, from, target, targetStatus, segment404s, polls: results };
}

async function captureHls(base, channelId, onTick) {
  const t0 = Date.now();
  await until(
    'hls session',
    async () => (await fetch(`${base}/stream/channels/${channelId}.m3u8?mode=${opt.mode}`)).ok,
    90_000,
    1500,
  );
  const listUrl = hlsListUrl(base, channelId);
  const segDir = path.join(out, 'segments');
  fs.mkdirSync(segDir, { recursive: true });
  const seen = new Set();
  const pieces = [];
  const sessionRestarts = [];
  let captured = 0;
  const end = Date.now() + (seconds + 90) * 1000;
  while (captured < seconds && Date.now() < end) {
    onTick?.(t0);
    const res = await fetch(listUrl);
    if (res.status === 404) {
      // The session died (Tunarr logs why in tunarr.log). Restart it and keep capturing.
      sessionRestarts.push(new Date().toISOString());
      await fetch(`${base}/stream/channels/${channelId}.m3u8?mode=${opt.mode}`);
    } else if (res.ok) {
      const lines = (await res.text()).split('\n').map((l) => l.trim());
      let disc = false;
      let dur = 0;
      for (const line of lines) {
        if (line.startsWith('#EXT-X-DISCONTINUITY')) disc = true;
        else if (line.startsWith('#EXTINF:')) dur = parseFloat(line.slice(8));
        else if (line && !line.startsWith('#')) {
          if (!seen.has(line)) {
            seen.add(line);
            const url = new URL(line, listUrl).toString();
            const seg = await fetch(url);
            if (seg.ok) {
              const file = path.join(segDir, `${String(pieces.length).padStart(4, '0')}-${path.basename(new URL(url).pathname)}`);
              fs.writeFileSync(file, Buffer.from(await seg.arrayBuffer()));
              pieces.push({ file, discontinuityBefore: disc, extinf: dur, fetchedAtMs: Date.now() - t0 });
              captured += dur;
            }
          }
          disc = false;
        }
      }
    }
    await sleep(1000);
  }
  return { t0, pieces, sessionRestarts, seen };
}

// ---------- analysis ----------

// Checks one run of packets that should have continuous timestamps. Sorting by
// PTS first keeps B-frame reordering from reading as a backward jump; a real
// backward jump then shows up as overlapping or duplicate timestamps.
function continuity(ptsByStream, label) {
  const findings = [];
  for (const [stream, list] of Object.entries(ptsByStream)) {
    const pts = [...list].sort((a, b) => a - b);
    if (pts.length < 3) continue;
    const deltas = pts.slice(1).map((t, i) => t - pts[i]);
    const median = [...deltas].sort((a, b) => a - b)[Math.floor(deltas.length / 2)];
    let run = null;
    const flush = () => run && findings.push(run) && (run = null);
    deltas.forEach((d, i) => {
      const kind = d < 0.25 * median ? 'pts_overlap' : d > Math.max(3 * median, 0.25) ? 'pts_gap' : null;
      if (!kind) return flush();
      if (run && run.kind === kind) {
        run.count++;
        run.lastAt = +pts[i + 1].toFixed(3);
        run.totalS = +(run.totalS + d).toFixed(3);
      } else {
        flush();
        run = { kind, stream, in: label, at: +pts[i].toFixed(3), lastAt: +pts[i + 1].toFixed(3), count: 1, totalS: +d.toFixed(3), typicalDeltaS: +median.toFixed(4) };
      }
    });
    flush();
  }
  return findings;
}

function analyze(pieces) {
  const perPiece = [];
  const findings = [];
  let runPts = {};
  let runLabel = null;
  const closeRun = () => {
    if (runLabel) findings.push(...continuity(runPts, runLabel));
    runPts = {};
  };
  for (const p of pieces) {
    if (p.discontinuityBefore || runLabel === null) {
      closeRun();
      runLabel = `from ${path.basename(p.file)}`;
    }
    const probe = ffprobeJson(p.file);
    const streams = probe.streams.map((s) => ({
      index: s.index,
      type: s.codec_type,
      codec: s.codec_name,
      lang: s.tags?.language,
      ...(s.codec_type === 'video' ? { size: `${s.width}x${s.height}`, fps: s.r_frame_rate } : {}),
      ...(s.codec_type === 'audio' ? { sampleRate: s.sample_rate, channels: s.channels } : {}),
    }));
    const firstPts = {};
    for (const pk of probe.packets) {
      const t = parseFloat(pk.pts_time);
      if (Number.isNaN(t)) continue;
      const type = probe.streams.find((s) => s.index === pk.stream_index)?.codec_type ?? 'unknown';
      firstPts[type] ??= t;
      if (type === 'video' || type === 'audio') ((runPts[`${type}:${pk.stream_index}`] ??= []).push(t));
    }
    const avOffsetMs =
      firstPts.video !== undefined && firstPts.audio !== undefined
        ? Math.round((firstPts.audio - firstPts.video) * 1000)
        : null;
    const counts = streams.reduce((m, s) => ((m[s.type] = (m[s.type] ?? 0) + 1), m), {});
    perPiece.push({
      file: path.basename(p.file),
      discontinuityBefore: p.discontinuityBefore,
      streamCounts: counts,
      streams,
      firstVideoPts: firstPts.video,
      firstAudioPts: firstPts.audio,
      avStartOffsetMs: avOffsetMs,
    });
  }
  closeRun();

  // Track layout changes between consecutive pieces flag duplicate or dropped tracks.
  for (let i = 1; i < perPiece.length; i++) {
    const a = JSON.stringify(perPiece[i - 1].streamCounts);
    const b = JSON.stringify(perPiece[i].streamCounts);
    if (a !== b) findings.push({ kind: 'track_layout_change', from: perPiece[i - 1].streamCounts, to: perPiece[i].streamCounts, file: perPiece[i].file, atDiscontinuity: perPiece[i].discontinuityBefore });
  }
  for (const pc of perPiece) {
    if (pc.avStartOffsetMs !== null && Math.abs(pc.avStartOffsetMs) > 100 && (pc.discontinuityBefore || pc === perPiece[0])) {
      findings.push({ kind: 'av_start_offset', file: pc.file, offsetMs: pc.avStartOffsetMs });
    }
  }
  return { perPiece, findings };
}

function ffmpegCommands() {
  const logFile = path.join(dbDir, 'logs', 'tunarr.log');
  if (!fs.existsSync(logFile)) return { logFile, commands: [], note: 'tunarr.log not found' };
  const commands = [];
  for (const line of fs.readFileSync(logFile, 'utf8').split('\n')) {
    if (!line.includes('Starting ffmpeg with args')) continue;
    try {
      const j = JSON.parse(line);
      commands.push({ time: j.time, args: String(j.msg).replace(/^Starting ffmpeg with args: "?|"$/g, '') });
    } catch {
      commands.push({ raw: line });
    }
  }
  return { logFile, commands };
}

// ---------- main ----------

if (opt.reanalyze) {
  const report = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
  const pieces = report.capturePieces.map((p) => ({ ...p, file: path.join(out, p.file) }));
  Object.assign(report, analyze(pieces), { reanalyzedAt: new Date().toISOString() });
  for (const at of report.sessionRestarts ?? []) report.findings.push({ kind: 'hls_session_restarted', at });
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  log(`report: ${path.join(out, 'report.json')}`);
  process.exit();
}

const report = { startedAt: new Date().toISOString(), options: opt, out };
let server;
try {
  let channel;
  if (opt.source === 'synthetic') {
    const clipsDir = path.join(out, 'media');
    log('generating clips', opt.layout);
    report.clips = makeClips(clipsDir);
    log('starting server');
    server = await startServer();
    report.ffmpegSettings = await applyFfmpegSettings(server.base);
    log('building channel', server.base);
    channel = await buildSyntheticChannel(server.base, clipsDir);
    if (opt['truncate-clip']) truncateClip(clipsDir, opt['truncate-clip']);
    if (opt.schedule) {
      log('applying schedule', opt.schedule);
      report.schedule = await applySchedule(server.base, channel, path.resolve(opt.schedule));
    }
  } else if (opt.source === 'copy') {
    if (opt.schedule) throw new Error('--schedule only works with --source synthetic');
    if (!opt.channel) throw new Error('--source copy needs --channel <number|uuid>');
    log('copying database');
    prepareDbCopy();
    server = await startServer();
    report.ffmpegSettings = await applyFfmpegSettings(server.base);
    const ch = await findChannel(server.base, opt.channel);
    await applyResolution(server.base, ch.transcodeConfigId);
    channel = { channelId: ch.id, startTime: ch.startTime, lineup: null };
  } else {
    throw new Error(`unknown --source ${opt.source}`);
  }
  report.server = server.base;
  report.channel = channel;
  if (seconds === 0) {
    log('--seconds 0: skipping the stream capture');
    throw new SkipCapture();
  }

  log(`capturing ${seconds}s via ${opt.mode}`);
  // Runs beside the capture so the scan never pauses segment fetching.
  let midTruncateRun;
  let onTick;
  if (opt['mid-truncate']) {
    if (opt.source !== 'synthetic' || opt.mode === 'mpegts') throw new Error('--mid-truncate needs --source synthetic and an HLS mode');
    const spec = parseMidTruncate(opt['mid-truncate']);
    onTick = (t0) => {
      if (!midTruncateRun && Date.now() - t0 >= spec.atMs) {
        midTruncateRun = midTruncate(server.base, channel, path.join(out, 'media'), spec, t0).catch((e) => ({ error: String(e.stack ?? e) }));
      }
    };
  }
  const cap = opt.mode === 'mpegts' ? await captureTs(server.base, channel.channelId) : await captureHls(server.base, channel.channelId, onTick);
  if (midTruncateRun) report.midTruncate = await midTruncateRun;
  report.captureStartedAt = new Date(cap.t0).toISOString();
  report.pieces = cap.pieces.length;
  report.capturePieces = cap.pieces.map((p) => ({ ...p, file: path.relative(out, p.file) }));
  report.sessionRestarts = cap.sessionRestarts ?? [];

  log('analyzing');
  Object.assign(report, analyze(cap.pieces));
  for (const at of report.sessionRestarts) report.findings.push({ kind: 'hls_session_restarted', at });

  if (opt.rewind !== undefined) {
    if (opt.mode === 'mpegts') throw new Error('--rewind needs an HLS mode');
    log(`rewinding ${opt.rewind} segments`);
    report.rewind = await rewindHls(server.base, channel.channelId, cap.seen);
    if (report.rewind.targetStatus === 404) {
      report.findings.push({ kind: 'rewind_target_missing', segment: report.rewind.target });
    }
    for (const p of report.rewind.polls) {
      if (p.missing?.length) report.findings.push({ kind: 'playlist_lists_missing_segment', poll: p.poll, files: p.missing });
    }
  }
  report.ffmpeg = ffmpegCommands();
} catch (e) {
  if (!(e instanceof SkipCapture)) {
    report.error = String(e.stack ?? e);
    process.exitCode = 1;
  }
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  if (server && opt['keep-server']) log(`server left running at ${server.base} (pid group ${server.pid})`);
  log(`report: ${path.join(out, 'report.json')}`);
  process.exit();
}
