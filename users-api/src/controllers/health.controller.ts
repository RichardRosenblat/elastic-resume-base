import { Request, Response } from 'express';

/** Responds with liveness status. */
export function getLive(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok' });
}

/** Responds with readiness status. */
export function getReady(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok' });
}
