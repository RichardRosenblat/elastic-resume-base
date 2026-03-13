import { Router } from 'express';
import { readDocumentHandler } from '../controllers/documents.controller.js';

const router = Router();

router.post('/read', readDocumentHandler);

export default router;
