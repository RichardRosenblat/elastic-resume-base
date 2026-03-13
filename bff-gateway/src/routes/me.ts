import { Router, Response, NextFunction, Request } from 'express';
import { AuthenticatedRequest } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response, _next: NextFunction) => {
  const authReq = req as AuthenticatedRequest;
  const { uid, email, name, picture } = authReq.user;
  res.status(200).json({
    success: true,
    data: { uid, email, name, picture },
    correlationId: authReq.correlationId,
  });
});

export default router;
