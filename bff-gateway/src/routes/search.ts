import type { FastifyPluginAsync } from 'fastify';
import { searchHandler } from '../controllers/search.controller.js';

const searchPlugin: FastifyPluginAsync = async (app) => {
  app.post('/', {
    schema: {
      tags: ['Search'],
      summary: 'Perform a semantic search',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          filters: { type: 'object', additionalProperties: true },
          limit: { type: 'integer' },
          offset: { type: 'integer' },
        },
      },
    },
  }, searchHandler);
};

export default searchPlugin;
