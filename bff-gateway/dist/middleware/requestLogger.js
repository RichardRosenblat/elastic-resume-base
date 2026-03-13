"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
const logger_1 = require("../utils/logger");
function requestLogger(req, res, next) {
    const start = Date.now();
    const correlationId = req.correlationId;
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger_1.logger.info('HTTP request', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: duration,
            correlationId,
        });
    });
    next();
}
//# sourceMappingURL=requestLogger.js.map