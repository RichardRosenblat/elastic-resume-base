"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.correlationIdMiddleware = correlationIdMiddleware;
const uuid_1 = require("uuid");
function correlationIdMiddleware(req, res, next) {
    const correlationId = req.headers['x-correlation-id'] || (0, uuid_1.v4)();
    req.correlationId = correlationId;
    res.setHeader('x-correlation-id', correlationId);
    next();
}
//# sourceMappingURL=correlationId.js.map