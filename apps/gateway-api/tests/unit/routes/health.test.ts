import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../../src/middleware/auth.js';
import {
  _resetRegistryForTest,
  _setRegistryEntryForTest,
} from '../../../src/services/serviceRegistry.js';

jest.mock('axios', () => {
  const actual = jest.requireActual<typeof import('axios')>('axios');
  return {
    ...actual,
    get: jest.fn(),
    create: jest.fn().mockReturnValue({
      get: jest.fn(),
      post: jest.fn(),
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    }),
  };
});

import axios from 'axios';

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    _setTokenVerifier({ verifyToken: jest.fn() });
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    _resetTokenVerifier();
  });

  beforeEach(() => {
    _resetRegistryForTest();
    (axios.get as jest.Mock).mockReset();
  });

  it('GET /health/live returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/live' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  it('GET /health/ready returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health/ready' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok' });
  });

  describe('GET /health/downstream', () => {
    const now = new Date().toISOString();
    const recentTime = new Date(Date.now() - 1000).toISOString(); // 1 s ago → warm
    const oldTime = new Date(Date.now() - 600_000).toISOString(); // 10 min ago → cold

    it('returns 200 with service registry snapshot', async () => {
      _setRegistryEntryForTest('usersApi', { live: true, lastSeenAlive: recentTime, lastChecked: now });
      _setRegistryEntryForTest('downloader', { live: false, lastSeenAlive: oldTime, lastChecked: now });
      _setRegistryEntryForTest('searchBase', { live: true, lastSeenAlive: recentTime, lastChecked: now });
      _setRegistryEntryForTest('fileGenerator', { live: true, lastSeenAlive: recentTime, lastChecked: now });
      _setRegistryEntryForTest('documentReader', { live: true, lastSeenAlive: recentTime, lastChecked: now });

      const res = await app.inject({ method: 'GET', url: '/health/downstream' });
      expect(res.statusCode).toBe(200);

      const body = res.json<{ downstream: Record<string, { live: boolean; temperature: string; lastSeenAlive: string | null; lastChecked: string }> }>();
      expect(body).toHaveProperty('downstream');

      // All five services must be present
      expect(body.downstream).toHaveProperty('usersApi');
      expect(body.downstream).toHaveProperty('downloader');
      expect(body.downstream).toHaveProperty('searchBase');
      expect(body.downstream).toHaveProperty('fileGenerator');
      expect(body.downstream).toHaveProperty('documentReader');

      // usersApi — live and warm
      expect(body.downstream['usersApi']?.live).toBe(true);
      expect(body.downstream['usersApi']?.temperature).toBe('warm');
      expect(body.downstream['usersApi']?.lastSeenAlive).toBe(recentTime);

      // downloader — not live, cold
      expect(body.downstream['downloader']?.live).toBe(false);
      expect(body.downstream['downloader']?.temperature).toBe('cold');

      // All entries must include lastChecked
      for (const entry of Object.values(body.downstream)) {
        expect(entry).toHaveProperty('lastChecked');
      }
    });

    it('returns 200 even when all services are unreachable', async () => {
      for (const key of ['usersApi', 'downloader', 'searchBase', 'fileGenerator', 'documentReader']) {
        _setRegistryEntryForTest(key, { live: false, lastSeenAlive: null, lastChecked: now });
      }

      // The controller will probe "never seen" services; mock them all as failures
      (axios.get as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await app.inject({ method: 'GET', url: '/health/downstream' });
      expect(res.statusCode).toBe(200);

      const body = res.json<{ downstream: Record<string, { live: boolean }> }>();
      for (const svc of Object.values(body.downstream)) {
        expect(svc.live).toBe(false);
      }
    });

    it('triggers a probe for never-seen services and reflects the result', async () => {
      // Pre-populate all except usersApi so only usersApi gets probed
      _setRegistryEntryForTest('downloader', { live: true, lastSeenAlive: recentTime, lastChecked: now });
      _setRegistryEntryForTest('searchBase', { live: true, lastSeenAlive: recentTime, lastChecked: now });
      _setRegistryEntryForTest('fileGenerator', { live: true, lastSeenAlive: recentTime, lastChecked: now });
      _setRegistryEntryForTest('documentReader', { live: true, lastSeenAlive: recentTime, lastChecked: now });
      // usersApi is absent from registry → never seen → probe will be triggered

      (axios.get as jest.Mock).mockResolvedValueOnce({ status: 200 }); // usersApi probe succeeds

      const res = await app.inject({ method: 'GET', url: '/health/downstream' });
      expect(res.statusCode).toBe(200);

      const body = res.json<{ downstream: Record<string, { live: boolean; temperature: string }> }>();
      expect(body.downstream['usersApi']?.live).toBe(true);
      expect(body.downstream['usersApi']?.temperature).toBe('warm');
    });

    it('probe locking: concurrent requests share a single outbound probe', async () => {
      // All services never seen
      (axios.get as jest.Mock).mockResolvedValue({ status: 200 });

      const [res1, res2] = await Promise.all([
        app.inject({ method: 'GET', url: '/health/downstream' }),
        app.inject({ method: 'GET', url: '/health/downstream' }),
      ]);

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);

      // axios.get should be called at most once per service across both requests
      // (probe locking collapses duplicate concurrent probes)
      const callCount = (axios.get as jest.Mock).mock.calls.length;
      expect(callCount).toBeLessThanOrEqual(6); // at most 1 probe per service
    });
  });
});
