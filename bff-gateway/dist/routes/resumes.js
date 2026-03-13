"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const downloaderClient_1 = require("../services/downloaderClient");
const fileGeneratorClient_1 = require("../services/fileGeneratorClient");
const router = (0, express_1.Router)();
const ingestSchema = zod_1.z.object({
    sheetId: zod_1.z.string().optional(),
    batchId: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.unknown()).optional(),
}).refine(data => data.sheetId || data.batchId, {
    message: 'Either sheetId or batchId must be provided',
});
const generateSchema = zod_1.z.object({
    language: zod_1.z.string().min(2).max(10),
    format: zod_1.z.enum(['pdf', 'docx', 'html']),
});
router.post('/ingest', async (req, res, next) => {
    try {
        const body = ingestSchema.parse(req.body);
        const result = await (0, downloaderClient_1.triggerIngest)(body);
        res.status(202).json({
            success: true,
            data: result,
            correlationId: req.correlationId,
        });
    }
    catch (err) {
        next(err);
    }
});
router.post('/:resumeId/generate', async (req, res, next) => {
    try {
        const { resumeId } = req.params;
        const body = generateSchema.parse(req.body);
        const result = await (0, fileGeneratorClient_1.generateResume)(resumeId, body);
        res.status(202).json({
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
//# sourceMappingURL=resumes.js.map