"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/live', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
router.get('/ready', (_req, res) => {
    res.status(200).json({ status: 'ok' });
});
exports.default = router;
//# sourceMappingURL=health.js.map