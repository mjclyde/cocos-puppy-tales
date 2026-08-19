import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { BADGE_ICONS } from './lib/badges';

const coco = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coco' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    role: z.enum(['dam', 'sire']).default('dam'),
    breed: z.string(),
    heroImage: image(),
    personalityTraits: z.array(z.string()).default([]),
    healthFacts: z.array(z.string()).default([]),
    pedigree: z.string().optional(),
  }),
});

const journey = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journey' }),
  schema: ({ image }) => z.object({
    week: z.number(),
    phase: z.enum(['pregnancy', 'puppies']).default('pregnancy'),
    date: z.coerce.date(),
    title: z.string(),
    bellyPhoto: image().optional(),
    bellySizeComparison: z.string().optional(),
    puppyGrowth: z.object({
      eyebrow: z.string().default('Tiny puppy update'),
      title: z.string(),
      facts: z.array(z.object({
        label: z.string(),
        text: z.string(),
      })),
    }).optional(),
    published: z.boolean().default(true),
  }),
});

const breed = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/breed' }),
  schema: z.object({ title: z.string() }),
});

const litter = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/litter' }),
  schema: ({ image }) => z.object({
    bornDate: z.coerce.date(),
    count: z.number(),
    boys: z.number(),
    girls: z.number(),
    weightRange: z.string(),
    goHomeDate: z.coerce.date(),
    price: z.number().positive(),
    deposit: z.number().positive(),
    depositMethods: z.array(z.string()).min(1),
    healthGuarantee: z.string(),
    goesHomeWith: z.array(z.string()).min(1),
    raisingHighlights: z.array(z.string()).min(1),
    matchingNote: z.string(),
    headline: z.string(),
    /** The line under the headline — urgency/status copy, editable without code. */
    tagline: z.string(),
    heroImage: image(),
    collars: z.array(z.object({
      name: z.string(),
      hex: z.string(),
      sex: z.enum(['boy', 'girl']),
      status: z.enum(['available', 'reserved']).default('available'),
      note: z.string().optional(),
    })),
    published: z.boolean().default(true),
  }),
});

const site = defineCollection({
  loader: file('./src/content/site/config.json'),
  schema: z.object({
    dueDate: z.coerce.date(),
    litterEstimate: z.string(),
    contactEmail: z.string().email(),
    /** Where the puppies are raised, e.g. "Cache Valley, Utah". */
    location: z.string(),
    /** The home page's trust row — same promises as the printed flyer. */
    badges: z.array(z.object({
      label: z.string(),
      icon: z.enum(BADGE_ICONS),
    })).default([]),
    socialLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    // Shoot folder whose photos lead each cast card. Omit to fall back to newest-first.
    cardCoverShoot: z.string().optional(),
    flags: z.object({
      showGallery: z.boolean().default(true),
      showSubscribe: z.boolean().default(true),
      showPricing: z.boolean().default(true),
    }).default({ showGallery: true, showSubscribe: true, showPricing: true }),
  }),
});

export const collections = { coco, journey, breed, site, litter };
