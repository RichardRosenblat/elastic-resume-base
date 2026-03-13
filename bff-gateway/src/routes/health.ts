import { Router } from 'express';
import { getLive, getReady } from '../controllers/health.controller.js';

const router = Router();

router.get('/live', getLive);
router.get('/ready', getReady);

export default router;
