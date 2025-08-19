"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatAxiosError = formatAxiosError;
const axios_1 = require("axios");
function formatAxiosError(error) {
    if (error instanceof axios_1.AxiosError) {
        return {
            message: error.message,
            code: error.code,
            url: error.config?.url,
            method: error.config?.method,
            data: error.response?.data,
            status: error.response?.status,
        };
    }
    return { message: error.message || String(error) };
}
//# sourceMappingURL=formatAxiosError.utils.js.map