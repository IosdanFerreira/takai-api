"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processBatch = processBatch;
async function processBatch(items, fn, concurrency = 10) {
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        await Promise.all(batch.map(fn));
    }
}
//# sourceMappingURL=proccessBatch.utils.js.map