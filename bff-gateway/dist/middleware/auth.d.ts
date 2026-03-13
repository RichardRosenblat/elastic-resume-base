import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
export declare function getFirebaseApp(): admin.app.App;
export declare function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map