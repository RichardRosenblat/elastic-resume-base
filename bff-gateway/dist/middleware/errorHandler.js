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
        logger_1.logger.error('Unhandled error', { message: err.message, correlationId });
        res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
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