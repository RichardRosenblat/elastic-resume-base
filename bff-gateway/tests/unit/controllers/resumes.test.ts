import request from 'supertest';
import app from '../../../src/app.js';
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

import * as admin from 'firebase-admin';
import * as fileGeneratorClient from '../../../src/services/fileGeneratorClient.js';

const mockGenerateResponse = {
  jobId: 'job-123',
  status: 'accepted',
  downloadUrl: 'https://example.com/resume.pdf',
};

function setupAuth() {
  (admin.auth as jest.Mock).mockReturnValue({
    verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user-uid', email: 'user@example.com' }),
  });
}

describe('Resumes Controller - generate endpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (admin.apps as unknown[]).length = 0;
    _resetFirebaseApp();
    setupAuth();
  });

  it('POST /api/v1/resumes/:rid/generate accepts outputFormats and returns response', async () => {
    (fileGeneratorClient.generateResume as jest.Mock).mockResolvedValue(mockGenerateResponse);

    const res = await request(app)
      .post('/api/v1/resumes/rid123/generate')
      .set('Authorization', 'Bearer valid-token')
      .send({ language: 'en', format: 'pdf', outputFormats: ['pdf', 'docx'] });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ jobId: 'job-123', status: 'accepted' });
    expect(fileGeneratorClient.generateResume).toHaveBeenCalledWith('rid123', {
      language: 'en',
      format: 'pdf',
      outputFormats: ['pdf', 'docx'],
    });
  });

  it('POST /api/v1/resumes/:rid/generate works without outputFormats', async () => {
    (fileGeneratorClient.generateResume as jest.Mock).mockResolvedValue(mockGenerateResponse);

    const res = await request(app)
      .post('/api/v1/resumes/rid123/generate')
      .set('Authorization', 'Bearer valid-token')
      .send({ language: 'en', format: 'docx' });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/v1/resumes/:rid/generate returns 400 on invalid format enum', async () => {
    const res = await request(app)
      .post('/api/v1/resumes/rid123/generate')
      .set('Authorization', 'Bearer valid-token')
      .send({ language: 'en', format: 'xlsx' });

    expect(res.status).toBe(400);
  });

  it('POST /api/v1/resumes/:rid/generate returns 400 on invalid outputFormats item', async () => {
    const res = await request(app)
      .post('/api/v1/resumes/rid123/generate')
      .set('Authorization', 'Bearer valid-token')
      .send({ language: 'en', format: 'pdf', outputFormats: ['pdf', 'invalid'] });

    expect(res.status).toBe(400);
  });
});
