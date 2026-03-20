import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { _resetFirebaseApp } from '../../../src/middleware/auth.js';

jest.mock('firebase-admin', () => ({
  apps: [],
  initializeApp: jest.fn().mockReturnValue({}),
  auth: jest.fn().mockReturnValue({
    verifyIdToken: jest.fn(),
  }),
}));

jest.mock('../../../src/services/fileGeneratorClient', () => ({
  generateResume: jest.fn(),
}));

jest.mock('../../../src/services/userApiClient', () => ({
  checkUserAccess: jest.fn().mockResolvedValue('user'),
  getUserRole: jest.fn().mockResolvedValue('user'),
  getUserRolesBatch: jest.fn().mockResolvedValue({}),
  getUserById: jest.fn().mockResolvedValue({
    uid: 'user-uid',
    email: 'user@example.com',
    role: 'user',
    enabled: true,
    disabled: false,
  }),
  createUserInUsersApi: jest.fn(),
  getAllowlistEntry: jest.fn(),
  deleteAllowlistEntry: jest.fn(),
  upsertAllowlistEntry: jest.fn(),
}));

import * as admin from 'firebase-admin';
import * as fileGeneratorClient from '../../../src/services/fileGeneratorClient.js';

const mockGenerateResponse = {
  jobId: 'job-123',
  status: 'accepted',
  downloadUrl: 'https://example.com/resume.pdf',
};

function setupAuth() {
  (admin.auth as jest.Mock).mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-uid', email: 'user@example.com', email_verified: true }),
  });
}

describe('Resumes Controller - generate endpoint', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
    setupAuth();
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
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
});
