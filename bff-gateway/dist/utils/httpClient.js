"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpClient = createHttpClient;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
function createHttpClient(baseURL) {
    return axios_1.default.create({
        baseURL,
        timeout: config_1.config.requestTimeoutMs,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}
//# sourceMappingURL=httpClient.js.map