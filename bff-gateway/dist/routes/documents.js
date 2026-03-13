"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const documentReaderClient_1 = require("../services/documentReaderClient");
const router = (0, express_1.Router)();
const readSchema = zod_1.z.object({
    fileReference: zod_1.z.string().min(1),
    options: zod_1.z.object({
        extractTables: zod_1.z.boolean().optional(),
        language: zod_1.z.string().optional(),
    }).optional(),
});
router.post('/read', async (req, res, next) => {
    try {
        const body = readSchema.parse(req.body);
        const result = await (0, documentReaderClient_1.readDocument)(body);
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
//# sourceMappingURL=documents.js.map