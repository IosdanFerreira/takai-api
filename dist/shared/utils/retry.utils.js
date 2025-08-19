"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retry = retry;
async function retry(fn, retries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            if (attempt === retries)
                throw err;
            await new Promise((res) => setTimeout(res, delay * attempt));
        }
    }
}
//# sourceMappingURL=retry.utils.js.map