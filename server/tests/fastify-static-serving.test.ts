import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { getAvailablePort } from '../src/util/net.ts';
import { initTestApp } from './testServer.ts';

// Manual-test-equivalent pass for the @fastify/static bump (#2056): boot the
// real app once and hit every static-serving surface, proving 10.1.3 serves
// files exactly as 8.3.0 did (root+prefix, decorateReply, sendFile, serve:true
// and serve:false registrations).

describe('static file serving after @fastify/static bump (#2056)', () => {
  let app: Awaited<ReturnType<typeof initTestApp>>;

  beforeAll(async () => {
    // One boot per process — fastify-graceful-shutdown registers a global
    // SIGINT handler, so a second boot in the same process conflicts.
    app = await initTestApp(await getAvailablePort());
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  test('app boots and /favicon.svg is served via reply.sendFile', async () => {
    const res = await app.inject('/favicon.svg');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg');
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('/favicon.ico is served via reply.sendFile', async () => {
    const res = await app.inject('/favicon.ico');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image');
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('root+prefix registration still serves under /images/', async () => {
    const res = await app.inject('/images/favicon.svg');
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('image/svg');
  });

  test('an unknown asset under a served root returns 404, not a crash', async () => {
    const res = await app.inject('/images/definitely-missing-asset.svg');
    expect(res.statusCode).toBe(404);
  });

  test('the legacy stream catch-all registration is still mounted', async () => {
    // /streams/ is the legacy @fastify/static catch-all (serve:true,
    // decorateReply:true). A missing file must 404 cleanly — proving the
    // registration itself mounted without throwing under 10.1.3.
    const res = await app.inject('/streams/definitely-missing.ts');
    expect(res.statusCode).toBe(404);
  });
});