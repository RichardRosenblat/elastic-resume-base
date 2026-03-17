import { Router } from 'express';
import { ingest, generate } from '../controllers/resumes.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/resumes/ingest:
 *   post:
 *     summary: Trigger a resume ingest job
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sheetId:
 *                 type: string
 *               batchId:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       202:
 *         description: Ingest job accepted
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/ingest', ingest);

/**
 * @swagger
 * /api/v1/resumes/{resumeId}/generate:
 *   post:
 *     summary: Generate a resume file
 *     tags: [Resumes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: resumeId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - language
 *               - format
 *             properties:
 *               language:
 *                 type: string
 *               format:
 *                 type: string
 *                 enum: [pdf, docx, html]
 *               outputFormats:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [pdf, docx, html]
 *     responses:
 *       202:
 *         description: Generate job accepted
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post('/:resumeId/generate', generate);

export default router;
