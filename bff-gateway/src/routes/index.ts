import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import healthRouter from './health.js';
import meRouter from './me.js';
import resumesRouter from './resumes.js';
import searchRouter from './search.js';
import documentsRouter from './documents.js';
import usersRouter from './users.js';

const router = Router();

router.use('/health', healthRouter);

const apiV1 = Router();
apiV1.use(authMiddleware);

apiV1.use('/me', meRouter);
apiV1.use('/resumes', resumesRouter);
apiV1.use('/search', searchRouter);
apiV1.use('/documents', documentsRouter);
apiV1.use('/users', usersRouter);

router.use('/api/v1', apiV1);

export default router;
