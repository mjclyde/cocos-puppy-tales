import { z } from 'zod';

const emailSchema = z.string().email();

export function isValidEmail(value: string): boolean {
  return emailSchema.safeParse(value).success;
}

export interface SubscribePayload {
  email_address: string;
  tags: string[];
}

export function buildSubscribePayload(email: string): SubscribePayload {
  return { email_address: email, tags: ['coco-nursery'] };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}
