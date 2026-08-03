import { randomUUID } from 'node:crypto';

/**
 * The repository had no established Employee QR generator or tracked value
 * format. UUID v4 supplies 122 random bits without embedding employee data.
 */
export function generateEmployeeQrToken(): string {
  return randomUUID();
}

export const EMPLOYEE_QR_TOKEN_INSERT_ATTEMPTS = 3;
