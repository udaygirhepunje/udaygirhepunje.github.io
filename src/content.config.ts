import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const linkSchema = z.object({
  label: z.string(),
  url: z.string().url(),
});

const profile = defineCollection({
  loader: glob({ base: "./src/content/settings", pattern: "profile.yml" }),
  schema: z.object({
    name: z.string(),
    headline: z.string(),
    location: z.string(),
    email: z.string().email(),
    openToWork: z.boolean(),
    bio: z.string(),
    links: z.array(linkSchema),
  }),
});

const resume = defineCollection({
  loader: glob({ base: "./src/content/settings", pattern: "resume.yml" }),
  schema: z.object({
    name: z.string(),
    title: z.string(),
    location: z.string(),
    contact: z.object({
      email: z.string().email(),
      phone: z.string(),
      phoneVisibility: z.literal("pdf-only"),
      linkedin: z.string().url(),
      github: z.string().url(),
    }),
    summary: z.string(),
    experience: z.array(
      z.object({
        company: z.string(),
        role: z.string(),
        start: z.string(),
        end: z.string(),
        highlights: z.array(z.string()),
      }),
    ),
    education: z.array(
      z.object({
        degree: z.string(),
        institution: z.string(),
        start: z.string(),
        end: z.string(),
      }),
    ),
    skills: z.array(
      z.object({
        category: z.string(),
        items: z.array(z.string()),
      }),
    ),
    achievements: z.array(z.string()).default([]),
  }),
});

const projects = defineCollection({
  loader: glob({ base: "./src/content/projects", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    role: z.string(),
    problem: z.string().optional(),
    outcome: z.string().optional(),
    duration: z.string().optional(),
    achievement: z.string().optional(),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    technologies: z.array(z.string()),
    links: z.array(linkSchema).default([]),
    featured: z.boolean().default(false),
    hidden: z.boolean().default(false),
    order: z.number().int().nonnegative(),
  }),
});

const journal = defineCollection({
  loader: glob({ base: "./src/content/journal", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(["article", "photography", "artwork", "note"]).default("article"),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { profile, resume, projects, journal };
