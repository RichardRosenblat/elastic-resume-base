import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../../src/middleware/auth.js';

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
    it('returns 200 with downstream service statuses', async () => {
      (axios.get as jest.Mock)
        .mockResolvedValueOnce({ status: 200 })   // usersApi ok
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))  // downloader degraded
        .mockResolvedValueOnce({ status: 200 })   // searchBase ok
        .mockResolvedValueOnce({ status: 200 })   // fileGenerator ok
        .mockResolvedValueOnce({ status: 200 });  // documentReader ok

      const res = await app.inject({ method: 'GET', url: '/health/downstream' });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ downstream: Record<string, { status: string }> }>();
      expect(body).toHaveProperty('downstream');
      expect(body.downstream).toHaveProperty('usersApi');
      expect(body.downstream).toHaveProperty('downloader');
      expect(body.downstream).toHaveProperty('searchBase');
      expect(body.downstream).toHaveProperty('fileGenerator');
      expect(body.downstream).toHaveProperty('documentReader');
      expect(body.downstream['usersApi']?.status).toBe('ok');
      expect(body.downstream['downloader']?.status).toBe('degraded');
      expect(body.downstream['searchBase']?.status).toBe('ok');
      expect(body.downstream['fileGenerator']?.status).toBe('ok');
      expect(body.downstream['documentReader']?.status).toBe('ok');
    });

    it('returns 200 even when all downstream services are degraded', async () => {
      (axios.get as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));

      const res = await app.inject({ method: 'GET', url: '/health/downstream' });
      expect(res.statusCode).toBe(200);
      const body = res.json<{ downstream: Record<string, { status: string }> }>();
      for (const svc of Object.values(body.downstream)) {
        expect(svc.status).toBe('degraded');
      }
    });
  });
});
