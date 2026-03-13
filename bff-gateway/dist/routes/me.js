"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/', (req, res, _next) => {
    const authReq = req;
    const { uid, email, name, picture } = authReq.user;
    res.status(200).json({
        success: true,
        data: { uid, email, name, picture },
        correlationId: authReq.correlationId,
    });
});
exports.default = router;
//# sourceMappingURL=me.js.map