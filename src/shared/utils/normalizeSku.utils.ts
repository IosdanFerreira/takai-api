export function normalizeSku(sku: string): string {
  if (!sku) return '';

  // Remove espaços, caracteres especiais e sufixos como "-1", "-2", etc.
  return sku
    .toString()
    .trim()
    .replace(/[^\w\s]/gi, '')
    .replace(/\s+/g, '');
}
