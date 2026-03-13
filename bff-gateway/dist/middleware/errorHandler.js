"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
function errorHandler(err, req, res, _next) {
    const correlationId = req.correlationId;
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            success: false,
            error: {
                code: 'VALIDATION_ERROR',
                message: 'Request validation failed',
                details: err.errors,
            },
            correlationId,
        });
        return;
    }
    if (err instanceof Error) {
        const appError = err;
        const statusCode = appError.statusCode ?? 500;
        const isDownstreamError = statusCode !== 500;
        if (isDownstreamError) {
            logger_1.logger.warn('Downstream service error', { message: err.message, code: appError.code, statusCode, correlationId });
        }
        else {
            logger_1.logger.error('Unhandled error', { message: err.message, correlationId });
        }
        res.status(statusCode).json({
            success: false,
            error: {
                code: appError.code ?? 'INTERNAL_ERROR',
                message: isDownstreamError ? err.message : 'An unexpected error occurred',
            },
            correlationId,
        });
        return;
    }
    res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
        correlationId,
    });
}
//# sourceMappingURL=errorHandler.js.map