import { z } from 'zod';

const optionalText = (max: number) =>
  z.string().max(max).optional().or(z.literal(''));

export const waitlistSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('A valid email is required'),
  phone: optionalText(40),
  location: z.string().min(1, 'Location is required').max(120),
  about: z.string().min(1, 'Tell us a little about your home').max(2000),
  preferences: optionalText(500),
  read_expectations: z
    .union([z.literal('on'), z.literal('true'), z.boolean()])
    .transform((v) => v === true || v === 'on' || v === 'true'),
  source: optionalText(200),
  // Honeypot: real users never fill this; bots do. Must be empty.
  website: z.literal('').optional(),
});

export type WaitlistInput = z.infer<typeof waitlistSchema>;

export function parseWaitlist(data: unknown) {
  return waitlistSchema.safeParse(data);
}
