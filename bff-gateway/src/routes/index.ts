import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import healthRouter from './health';
import meRouter from './me';
import resumesRouter from './resumes';
import searchRouter from './search';
import documentsRouter from './documents';

const router = Router();

router.use('/health', healthRouter);

const apiV1 = Router();
apiV1.use(authMiddleware);

apiV1.use('/me', meRouter);
apiV1.use('/resumes', resumesRouter);
apiV1.use('/search', searchRouter);
apiV1.use('/documents', documentsRouter);

router.use('/api/v1', apiV1);

export default router;
