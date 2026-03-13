import { Router } from 'express';
import { searchHandler } from '../controllers/search.controller.js';

const router = Router();

router.post('/', searchHandler);

export default router;
