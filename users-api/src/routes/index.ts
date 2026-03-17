import { Router } from 'express';
import healthRouter from './health.js';
import usersRouter from './users.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/api/v1/users', usersRouter);

export default router;
