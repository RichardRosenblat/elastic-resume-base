import { Router } from 'express';
import { getLive, getReady } from '../controllers/health.controller.js';

const router = Router();

/** @swagger
 * /health/live:
 *   get:
 *     summary: Liveness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', getLive);

/** @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness probe
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 */
router.get('/ready', getReady);

export default router;
