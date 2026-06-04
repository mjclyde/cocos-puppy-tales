import { z } from 'zod';

export const WAITLIST_STATUSES = ['new', 'contacted', 'approved', 'declined'] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];

export const entryUpdateSchema = z
  .object({
    id: z.string().guid('A valid entry id is required'),
    status: z.enum(WAITLIST_STATUSES).optional(),
    notes: z.string().max(4000).optional().or(z.literal('')),
  })
  .refine((d) => d.status !== undefined || d.notes !== undefined, {
    message: 'Nothing to update',
  });

export type EntryUpdateInput = z.infer<typeof entryUpdateSchema>;

export function parseEntryUpdate(data: unknown) {
  return entryUpdateSchema.safeParse(data);
}
