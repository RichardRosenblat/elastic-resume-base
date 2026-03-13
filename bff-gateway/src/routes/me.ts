import { Router } from 'express';
import { getProfile } from '../controllers/me.controller.js';

const router = Router();

router.get('/', getProfile);

export default router;
