import type { FastifyPluginAsync } from 'fastify';
import { readDocumentHandler } from '../controllers/documents.controller.js';

const documentsPlugin: FastifyPluginAsync = async (app) => {
  app.post('/read', {
    schema: {
      tags: ['Documents'],
      summary: 'Read and extract text from a document',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['fileReference'],
        properties: {
          fileReference: { type: 'string' },
          options: {
            type: 'object',
            properties: {
              extractTables: { type: 'boolean' },
              language: { type: 'string' },
            },
          },
        },
      },
    },
  }, readDocumentHandler);
};

export default documentsPlugin;
