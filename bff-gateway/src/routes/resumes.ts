import { Router } from 'express';
import { ingest, generate } from '../controllers/resumes.controller.js';

const router = Router();

router.post('/ingest', ingest);
router.post('/:resumeId/generate', generate);

export default router;
