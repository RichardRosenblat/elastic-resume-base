import { Router } from 'express';
import { searchHandler } from '../controllers/search.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/search:
 *   post:
 *     summary: Perform a semantic search
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - query
 *             properties:
 *               query:
 *                 type: string
 *               filters:
 *                 type: object
 *               limit:
 *                 type: integer
 *               offset:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Search results
 *       401:
 *         description: Unauthorized
 */
router.post('/', searchHandler);

export default router;
