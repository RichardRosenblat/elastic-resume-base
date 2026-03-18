import type { FastifyPluginAsync } from 'fastify';
import { ingest, generate } from '../controllers/resumes.controller.js';

const resumesPlugin: FastifyPluginAsync = async (app) => {
  app.post('/ingest', {
    schema: {
      tags: ['Resumes'],
      summary: 'Trigger a resume ingest job',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          sheetId: { type: 'string' },
          batchId: { type: 'string' },
          metadata: { type: 'object', additionalProperties: true },
        },
      },
    },
  }, ingest);

  app.post('/:resumeId/generate', {
    schema: {
      tags: ['Resumes'],
      summary: 'Generate a resume file',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['resumeId'],
        properties: { resumeId: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['language', 'format'],
        properties: {
          language: { type: 'string' },
          format: { type: 'string', enum: ['pdf', 'docx', 'html'] },
          outputFormats: {
            type: 'array',
            items: { type: 'string', enum: ['pdf', 'docx', 'html'] },
          },
        },
      },
    },
  }, generate);
};

export default resumesPlugin;
