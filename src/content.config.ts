import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const coco = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/coco' }),
  schema: ({ image }) => z.object({
    name: z.string(),
    breed: z.string(),
    heroImage: image(),
    personalityTraits: z.array(z.string()),
    healthFacts: z.array(z.string()).default([]),
    pedigree: z.string().optional(),
  }),
});

const journey = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/journey' }),
  schema: ({ image }) => z.object({
    week: z.number(),
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
    headline: z.string(),
    heroImage: image(),
    collars: z.array(z.object({
      name: z.string(),
      hex: z.string(),
      sex: z.enum(['boy', 'girl']),
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
    socialLinks: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
    // Shoot folder whose photos lead each cast card. Omit to fall back to newest-first.
    cardCoverShoot: z.string().optional(),
    flags: z.object({
      showGallery: z.boolean().default(true),
      showSubscribe: z.boolean().default(true),
    }).default({ showGallery: true, showSubscribe: true }),
  }),
});

export const collections = { coco, journey, breed, site, litter };
