import { Router } from 'express';
import { readDocumentHandler } from '../controllers/documents.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/documents/read:
 *   post:
 *     summary: Read and extract text from a document
 *     tags: [Documents]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileReference
 *             properties:
 *               fileReference:
 *                 type: string
 *               options:
 *                 type: object
 *                 properties:
 *                   extractTables:
 *                     type: boolean
 *                   language:
 *                     type: string
 *     responses:
 *       200:
 *         description: Document text extracted
 *       401:
 *         description: Unauthorized
 */
router.post('/read', readDocumentHandler);

export default router;
