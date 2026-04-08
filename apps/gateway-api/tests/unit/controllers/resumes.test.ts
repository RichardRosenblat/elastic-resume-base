import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../../src/middleware/auth.js';

jest.mock('../../../src/services/fileGeneratorClient', () => ({
  generateResume: jest.fn(),
}));

jest.mock('../../../src/services/downloaderClient', () => ({
  triggerIngest: jest.fn(),
  triggerIngestDriveLink: jest.fn(),
  triggerIngestSingleFile: jest.fn(),
}));

jest.mock('../../../src/services/userApiClient', () => ({
  authorizeUser: jest.fn().mockResolvedValue({ role: 'user', enable: true }),
  getUserById: jest.fn(),
  listUsersFromApi: jest.fn(),
  updateUserInApi: jest.fn(),
  deleteUserFromApi: jest.fn(),
  listPreApprovedFromApi: jest.fn(),
  getPreApprovedFromApi: jest.fn(),
  addPreApprovedInApi: jest.fn(),
  deletePreApprovedFromApi: jest.fn(),
  updatePreApprovedInApi: jest.fn(),
}));

import * as fileGeneratorClient from '../../../src/services/fileGeneratorClient.js';
import * as downloaderClient from '../../../src/services/downloaderClient.js';

const mockGenerateResponse = {
  jobId: 'job-123',
  status: 'accepted',
  downloadUrl: 'https://example.com/resume.pdf',
};

const mockVerifier = { verifyToken: jest.fn() };

function setupAuth() {
  mockVerifier.verifyToken.mockResolvedValue({ uid: 'user-uid', email: 'user@example.com' });
}

describe('Resumes Controller - generate endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    _setTokenVerifier(mockVerifier);
    setupAuth();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    _resetTokenVerifier();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  it('POST /api/v1/resumes/:rid/generate accepts outputFormats and returns response', async () => {
    (fileGeneratorClient.generateResume as jest.Mock).mockResolvedValue(mockGenerateResponse);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/rid123/generate',
      headers: { authorization: 'Bearer valid-token' },
      payload: { language: 'en', format: 'pdf', outputFormats: ['pdf', 'docx'] },
    });

    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ jobId: 'job-123', status: 'accepted' });
    expect(fileGeneratorClient.generateResume).toHaveBeenCalledWith('rid123', {
      language: 'en',
      format: 'pdf',
      outputFormats: ['pdf', 'docx'],
    });
  });

  it('POST /api/v1/resumes/:rid/generate works without outputFormats', async () => {
    (fileGeneratorClient.generateResume as jest.Mock).mockResolvedValue(mockGenerateResponse);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/rid123/generate',
      headers: { authorization: 'Bearer valid-token' },
      payload: { language: 'en', format: 'docx' },
    });

    expect(res.statusCode).toBe(202);
    expect(res.json().success).toBe(true);
  });

  it('POST /api/v1/resumes/:rid/generate returns 400 on invalid format enum', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/rid123/generate',
      headers: { authorization: 'Bearer valid-token' },
      payload: { language: 'en', format: 'xlsx' },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/resumes/:rid/generate returns 400 on invalid outputFormats item', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/rid123/generate',
      headers: { authorization: 'Bearer valid-token' },
      payload: { language: 'en', format: 'pdf', outputFormats: ['pdf', 'invalid'] },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/resumes/:rid/generate returns 400 on invalid resumeId characters', async () => {
    (fileGeneratorClient.generateResume as jest.Mock).mockResolvedValue(mockGenerateResponse);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/bad%40id/generate',
      headers: { authorization: 'Bearer valid-token' },
      payload: { language: 'en', format: 'pdf' },
    });

    expect(res.statusCode).toBe(400);
  });
});

describe('Resumes Controller - ingest endpoint', () => {
  let app: FastifyInstance;
  const mockVerifier = { verifyToken: jest.fn() };

  function setupAuth() {
    mockVerifier.verifyToken.mockResolvedValue({ uid: 'user-uid', email: 'user@example.com' });
  }

  const mockIngestResponse = {
    jobId: 'job-ingest-1',
    status: 'accepted',
  };

  beforeAll(async () => {
    _setTokenVerifier(mockVerifier);
    setupAuth();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    _resetTokenVerifier();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  it('POST /api/v1/resumes/ingest returns 202 with sheetId', async () => {
    (downloaderClient.triggerIngest as jest.Mock).mockResolvedValue(mockIngestResponse);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest',
      headers: { authorization: 'Bearer valid-token' },
      payload: { sheetId: 'sheet-1' },
    });

    expect(res.statusCode).toBe(202);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ jobId: 'job-ingest-1', status: 'accepted' });
    expect(downloaderClient.triggerIngest).toHaveBeenCalledWith(
      expect.objectContaining({ sheetId: 'sheet-1' }),
    );
  });

  it('POST /api/v1/resumes/ingest returns 202 with sheetUrl', async () => {
    (downloaderClient.triggerIngest as jest.Mock).mockResolvedValue(mockIngestResponse);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest',
      headers: { authorization: 'Bearer valid-token' },
      payload: { sheetUrl: 'https://docs.google.com/spreadsheets/d/1abc/edit' },
    });

    expect(res.statusCode).toBe(202);
    expect(downloaderClient.triggerIngest).toHaveBeenCalledWith(
      expect.objectContaining({ sheetUrl: 'https://docs.google.com/spreadsheets/d/1abc/edit' }),
    );
  });

  it('POST /api/v1/resumes/ingest returns 202 with batchId', async () => {
    (downloaderClient.triggerIngest as jest.Mock).mockResolvedValue(mockIngestResponse);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest',
      headers: { authorization: 'Bearer valid-token' },
      payload: { batchId: 'batch-1' },
    });

    expect(res.statusCode).toBe(202);
  });

  it('POST /api/v1/resumes/ingest returns 202 with metadata', async () => {
    (downloaderClient.triggerIngest as jest.Mock).mockResolvedValue(mockIngestResponse);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest',
      headers: { authorization: 'Bearer valid-token' },
      payload: { sheetId: 'sheet-1', metadata: { campaign: 'spring-2026' } },
    });

    expect(res.statusCode).toBe(202);
  });

  it('POST /api/v1/resumes/ingest returns 400 when neither sheetId nor batchId is provided', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest',
      headers: { authorization: 'Bearer valid-token' },
      payload: { metadata: { campaign: 'test' } },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/resumes/ingest returns 401 when unauthenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest',
      payload: { sheetId: 'sheet-1' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('Resumes Controller - ingestDriveLink endpoint', () => {
  let app: FastifyInstance;
  const mockVerifier = { verifyToken: jest.fn() };

  function setupAuth() {
    mockVerifier.verifyToken.mockResolvedValue({ uid: 'user-uid', email: 'user@example.com' });
  }

  const mockDriveLinkResponse = {
    resumeId: 'resume-abc123',
    ingested: 1,
    errors: [],
    duplicates: [],
  };

  beforeAll(async () => {
    _setTokenVerifier(mockVerifier);
    setupAuth();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    _resetTokenVerifier();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  it('POST /api/v1/resumes/ingest/drive returns 200 with valid driveLink', async () => {
    (downloaderClient.triggerIngestDriveLink as jest.Mock).mockResolvedValue(mockDriveLinkResponse);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest/drive',
      headers: { authorization: 'Bearer valid-token' },
      payload: { driveLink: 'https://drive.google.com/file/d/1abc/view' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({ resumeId: 'resume-abc123', ingested: 1 });
    expect(downloaderClient.triggerIngestDriveLink).toHaveBeenCalledWith(
      expect.objectContaining({ driveLink: 'https://drive.google.com/file/d/1abc/view' }),
    );
  });

  it('POST /api/v1/resumes/ingest/drive returns 400 when driveLink is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest/drive',
      headers: { authorization: 'Bearer valid-token' },
      payload: { metadata: {} },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/v1/resumes/ingest/drive returns 401 when unauthenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest/drive',
      payload: { driveLink: 'https://drive.google.com/file/d/1abc/view' },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe('Resumes Controller - ingestSingleFile endpoint', () => {
  let app: FastifyInstance;
  const mockVerifier = { verifyToken: jest.fn() };

  function setupAuth() {
    mockVerifier.verifyToken.mockResolvedValue({ uid: 'user-uid', email: 'user@example.com' });
  }

  beforeAll(async () => {
    _setTokenVerifier(mockVerifier);
    setupAuth();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
    _resetTokenVerifier();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupAuth();
  });

  it('POST /api/v1/resumes/ingest/file returns 400 when content-type is not multipart/form-data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest/file',
      headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json' },
      payload: '{}',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('BAD_REQUEST');
  });

  it('POST /api/v1/resumes/ingest/file returns 401 when unauthenticated', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/resumes/ingest/file',
      payload: {},
    });

    expect(res.statusCode).toBe(401);
  });
});
