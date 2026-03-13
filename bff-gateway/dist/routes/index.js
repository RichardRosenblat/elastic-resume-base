"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const health_1 = __importDefault(require("./health"));
const me_1 = __importDefault(require("./me"));
const resumes_1 = __importDefault(require("./resumes"));
const search_1 = __importDefault(require("./search"));
const documents_1 = __importDefault(require("./documents"));
const router = (0, express_1.Router)();
router.use('/health', health_1.default);
const apiV1 = (0, express_1.Router)();
apiV1.use(auth_1.authMiddleware);
apiV1.use('/me', me_1.default);
apiV1.use('/resumes', resumes_1.default);
apiV1.use('/search', search_1.default);
apiV1.use('/documents', documents_1.default);
router.use('/api/v1', apiV1);
exports.default = router;
//# sourceMappingURL=index.js.map