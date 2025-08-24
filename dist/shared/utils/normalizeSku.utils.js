"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeSku = normalizeSku;
function normalizeSku(sku) {
    if (!sku)
        return '';
    return sku
        .toString()
        .trim()
        .replace(/[^\w\s]/gi, '')
        .replace(/\s+/g, '');
}
//# sourceMappingURL=normalizeSku.utils.js.map