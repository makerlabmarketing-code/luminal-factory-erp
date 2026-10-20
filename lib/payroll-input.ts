export function payrollAdjustmentInput(amount: unknown, reason: unknown) {
  const value = typeof amount === 'number' ? amount : typeof amount === 'string' && /^-?\d+$/.test(amount.trim()) ? Number(amount) : NaN;
  const explanation = typeof reason === 'string' ? reason.trim() : '';
  if (!Number.isSafeInteger(value) || value === 0 || Math.abs(value) > 999_999_999_999 || explanation.length < 3 || explanation.length > 1000) {
    throw new Error('Nhập số tiền nguyên khác 0 và lý do từ 3 đến 1.000 ký tự.');
  }
  return { amount: value, reason: explanation };
}
