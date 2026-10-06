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
if (opt.source === 'synthetic' && Number(opt['clip-seconds']) < 30) {
  console.error('[repro] warning: clips under 30s get skipped; Tunarr jumps to the next program when <10s remain (SLACK in shared/src/util/constants.ts)');
}
const log = (...a) => console.error('[repro]', ...a);

// ---------- helpers ----------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  const dur = Number(opt['clip-seconds']);
  const clips = [];
  for (let i = 0; i < Number(opt.clips); i++) {
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
  const startTime = Date.now();
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
    lineup: programs.map((p) => ({ type: 'content', id: p.id, duration: p.duration })),
  });
  return {
    channelId: channel.id,
    startTime,
    lineup: programs.map((p) => ({ title: p.program?.title, durationMs: p.duration })),
  };
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

async function captureHls(base, channelId) {
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
              pieces.push({ file, discontinuityBefore: disc, extinf: dur });
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
    log('building channel', server.base);
    channel = await buildSyntheticChannel(server.base, clipsDir);
  } else if (opt.source === 'copy') {
    if (!opt.channel) throw new Error('--source copy needs --channel <number|uuid>');
    log('copying database');
    prepareDbCopy();
    server = await startServer();
    const ch = await findChannel(server.base, opt.channel);
    channel = { channelId: ch.id, startTime: ch.startTime, lineup: null };
  } else {
    throw new Error(`unknown --source ${opt.source}`);
  }
  report.server = server.base;
  report.channel = channel;

  log(`capturing ${seconds}s via ${opt.mode}`);
  const cap = opt.mode === 'mpegts' ? await captureTs(server.base, channel.channelId) : await captureHls(server.base, channel.channelId);
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
  report.error = String(e.stack ?? e);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  if (server && opt['keep-server']) log(`server left running at ${server.base} (pid group ${server.pid})`);
  log(`report: ${path.join(out, 'report.json')}`);
  process.exit();
}
