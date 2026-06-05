import { z } from 'zod';

const emailSchema = z.string().email();

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
