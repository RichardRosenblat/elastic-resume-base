"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const config_1 = require("../config");
function log(level, message, meta = {}) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        ...meta,
    };
    const output = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') {
        process.stderr.write(output + '\n');
    }
    else {
        process.stdout.write(output + '\n');
    }
}
exports.logger = {
    debug: (message, meta) => {
        if (config_1.config.nodeEnv !== 'production') {
            log('debug', message, meta);
        }
    },
    info: (message, meta) => log('info', message, meta),
    warn: (message, meta) => log('warn', message, meta),
    error: (message, meta) => log('error', message, meta),
};
//# sourceMappingURL=logger.js.map