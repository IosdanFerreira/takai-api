"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.proccessPaymentMethod = proccessPaymentMethod;
function proccessPaymentMethod(paymentMethod) {
    switch (paymentMethod.toLowerCase()) {
        case 'visa':
            return 'CCV';
        case 'mastercard':
            return 'CCM';
        case 'american express':
            return 'CCA';
        case 'elo':
            return 'CCE';
        case 'hipercard':
            return 'CCH';
        case 'diners club':
            return 'CCD';
        default:
            return paymentMethod;
    }
}
//# sourceMappingURL=proccessPaymentMethod.utils.js.map