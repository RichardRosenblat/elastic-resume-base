"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFirebaseApp = getFirebaseApp;
exports.authMiddleware = authMiddleware;
const admin = __importStar(require("firebase-admin"));
const logger_1 = require("../utils/logger");
let firebaseApp = null;
function getFirebaseApp() {
    if (!firebaseApp) {
        if (admin.apps.length > 0) {
            firebaseApp = admin.apps[0];
        }
        else {
            firebaseApp = admin.initializeApp({
                projectId: process.env.FIREBASE_PROJECT_ID || 'demo-elastic-resume-base',
            });
        }
    }
    return firebaseApp;
}
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' },
        });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const app = getFirebaseApp();
        const decoded = await admin.auth(app).verifyIdToken(token);
        req.user = {
            uid: decoded.uid,
            email: decoded.email,
            name: decoded.name,
            picture: decoded.picture,
        };
        next();
    }
    catch (err) {
        logger_1.logger.warn('Token verification failed', { correlationId: req.correlationId });
        res.status(401).json({
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' },
        });
    }
}
//# sourceMappingURL=auth.js.map