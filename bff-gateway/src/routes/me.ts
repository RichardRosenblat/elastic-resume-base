import { Router } from 'express';
import { getProfile } from '../controllers/me.controller.js';

const router = Router();

/**
 * @swagger
 * /api/v1/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Me]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *       401:
 *         description: Unauthorized
 */
router.get('/', getProfile);

export default router;
