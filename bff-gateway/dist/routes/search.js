"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const searchClient_1 = require("../services/searchClient");
const router = (0, express_1.Router)();
const searchSchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(1000),
    filters: zod_1.z.record(zod_1.z.unknown()).optional(),
    limit: zod_1.z.number().int().min(1).max(100).optional(),
    offset: zod_1.z.number().int().min(0).optional(),
});
router.post('/', async (req, res, next) => {
    try {
        const body = searchSchema.parse(req.body);
        const result = await (0, searchClient_1.search)(body);
        res.status(200).json({
            success: true,
            data: result,
            correlationId: req.correlationId,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
//# sourceMappingURL=search.js.map