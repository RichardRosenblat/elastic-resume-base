import { Router, Request, Response } from 'express';

const router = Router();

router.get('/live', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

router.get('/ready', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

export default router;
