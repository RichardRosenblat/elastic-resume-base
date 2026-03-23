import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../../src/app.js';
import { _setTokenVerifier, _resetTokenVerifier } from '../../../src/middleware/auth.js';

jest.mock('../../../src/services/fileGeneratorClient', () => ({
  generateResume: jest.fn(),
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
});
