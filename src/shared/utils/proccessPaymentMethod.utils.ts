export function proccessPaymentMethod(paymentMethod: string) {
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
