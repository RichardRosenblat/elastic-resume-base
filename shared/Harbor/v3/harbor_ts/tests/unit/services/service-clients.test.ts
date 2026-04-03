/**
 * Unit tests for service clients (v3) — GatewayServiceClient, UsersServiceClient,
 * DocumentReaderServiceClient.
 *
 * Each service client is tested by injecting a mock IHarborClient.
 */

import type { AxiosResponse } from 'axios';
import type { IHarborClient } from '../../../src/client/harbor-client.js';
import { GatewayServiceClient } from '../../../src/services/client/gateway-service-client.js';
import { UsersServiceClient } from '../../../src/services/server/users-service-client.js';
import { DocumentReaderServiceClient } from '../../../src/services/server/document-reader-service-client.js';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeMockClient(): jest.Mocked<IHarborClient> {
  return {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
    axiosInstance: {} as IHarborClient['axiosInstance'],
  } as unknown as jest.Mocked<IHarborClient>;
}

function makeOkResponse<T>(data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config: {} as AxiosResponse['config'] };
}

// ── GatewayServiceClient ───────────────────────────────────────────────────

describe('GatewayServiceClient', () => {
  it('delegates get() to the injected HarborClient', async () => {
    const mockClient = makeMockClient();
    mockClient.get.mockResolvedValue(makeOkResponse({ ok: true }));

    const svc = new GatewayServiceClient(mockClient);
    const result = await svc.get('/api/v1/data');

    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/data', undefined);
    expect(result.data).toEqual({ ok: true });
  });

  it('delegates post() to the injected HarborClient', async () => {
    const mockClient = makeMockClient();
    mockClient.post.mockResolvedValue(makeOkResponse({ id: '123' }));

    const svc = new GatewayServiceClient(mockClient);
    const result = await svc.post('/api/v1/items', { name: 'test' });

    expect(mockClient.post).toHaveBeenCalledWith('/api/v1/items', { name: 'test' }, undefined);
    expect(result.data).toEqual({ id: '123' });
  });

  it('delegates put(), patch(), delete(), request()', async () => {
    const mockClient = makeMockClient();
    mockClient.put.mockResolvedValue(makeOkResponse({}));
    mockClient.patch.mockResolvedValue(makeOkResponse({}));
    mockClient.delete.mockResolvedValue(makeOkResponse({}));
    mockClient.request.mockResolvedValue(makeOkResponse({}));

    const svc = new GatewayServiceClient(mockClient);
    await svc.put('/url', {});
    await svc.patch('/url', {});
    await svc.delete('/url');
    await svc.request({ method: 'GET', url: '/url' });

    expect(mockClient.put).toHaveBeenCalledTimes(1);
    expect(mockClient.patch).toHaveBeenCalledTimes(1);
    expect(mockClient.delete).toHaveBeenCalledTimes(1);
    expect(mockClient.request).toHaveBeenCalledTimes(1);
  });
});

// ── UsersServiceClient ─────────────────────────────────────────────────────

describe('UsersServiceClient', () => {
  it('delegates get() to the injected HarborClient', async () => {
    const mockClient = makeMockClient();
    mockClient.get.mockResolvedValue(makeOkResponse([{ id: 'u1', email: 'a@b.com' }]));

    const svc = new UsersServiceClient(mockClient);
    const result = await svc.get('/api/v1/users');

    expect(mockClient.get).toHaveBeenCalledWith('/api/v1/users', undefined);
    expect(result.data).toHaveLength(1);
  });

  it('delegates post() to the injected HarborClient', async () => {
    const mockClient = makeMockClient();
    mockClient.post.mockResolvedValue(makeOkResponse({ created: true }));

    const svc = new UsersServiceClient(mockClient);
    await svc.post('/api/v1/users', { email: 'new@b.com' });

    expect(mockClient.post).toHaveBeenCalledWith(
      '/api/v1/users',
      { email: 'new@b.com' },
      undefined,
    );
  });
});

// ── DocumentReaderServiceClient ───────────────────────────────────────────

describe('DocumentReaderServiceClient', () => {
  it('delegates post() to the injected HarborClient', async () => {
    const mockClient = makeMockClient();
    mockClient.post.mockResolvedValue(makeOkResponse({ text: 'extracted content' }));

    const svc = new DocumentReaderServiceClient(mockClient);
    const result = await svc.post('/read', { fileReference: 'gs://bucket/file.pdf' });

    expect(mockClient.post).toHaveBeenCalledWith(
      '/read',
      { fileReference: 'gs://bucket/file.pdf' },
      undefined,
    );
    expect(result.data).toEqual({ text: 'extracted content' });
  });

  it('delegates get() to the injected HarborClient', async () => {
    const mockClient = makeMockClient();
    mockClient.get.mockResolvedValue(makeOkResponse({ status: 'ok' }));

    const svc = new DocumentReaderServiceClient(mockClient);
    await svc.get('/health');

    expect(mockClient.get).toHaveBeenCalledWith('/health', undefined);
  });
});
