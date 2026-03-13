"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const config_1 = require("./config");
const logger_1 = require("./utils/logger");
const app_1 = __importDefault(require("./app"));
const auth_1 = require("./middleware/auth");
// Initialize Firebase on startup
(0, auth_1.getFirebaseApp)();
const server = app_1.default.listen(config_1.config.port, () => {
    logger_1.logger.info('BFF Gateway started', { port: config_1.config.port, env: config_1.config.nodeEnv });
});
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger_1.logger.info('Server closed');
        process.exit(0);
    });
});
exports.default = server;
//# sourceMappingURL=server.js.map