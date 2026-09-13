export function roundMoney(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function calculateTax(sellingPrice: number, taxType: string, taxRate: number): number {
  const rate = Number(taxRate) || 0;
  if (taxType === 'INCLUSIVE') {
    return sellingPrice - sellingPrice / (1 + rate / 100);
  }
  if (taxType === 'EXCLUSIVE') {
    return sellingPrice * (rate / 100);
  }
  return 0;
}

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
