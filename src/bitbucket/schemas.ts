import { z } from 'zod/v4';

const optionalText = z.string().nullish();

export const pullRequestResponseSchema = z
  .object({
    id: z.number().int().positive(),
    title: z.string(),
    description: optionalText,
    state: z.string(),
    author: z
      .object({
        display_name: optionalText,
        account_id: optionalText,
      })
      .nullish(),
    source: z.object({
      branch: z.object({ name: z.string() }),
    }),
    destination: z.object({
      branch: z.object({ name: z.string() }),
    }),
    links: z.object({
      html: z.object({ href: z.string() }),
    }),
  })
  .loose();

const commitResponseSchema = z
  .object({
    hash: z.string().min(1),
    message: optionalText,
    date: optionalText,
    author: z.object({ raw: optionalText }).nullish(),
  })
  .loose();

export const commitPageResponseSchema = z
  .object({
    values: z.array(commitResponseSchema),
    next: z.string().min(1).nullish(),
  })
  .loose();

const commentResponseSchema = z
  .object({
    id: z.number().int().positive(),
    deleted: z.boolean().nullish(),
    content: z.object({ raw: optionalText }).nullish(),
    created_on: optionalText,
    updated_on: optionalText,
    author: z
      .object({
        display_name: optionalText,
        account_id: optionalText,
      })
      .nullish(),
    inline: z
      .object({
        path: z.string(),
        from: z.number().int().positive().nullish(),
        to: z.number().int().positive().nullish(),
      })
      .nullish(),
    parent: z.object({ id: z.number().int().positive() }).nullish(),
  })
  .loose();

export const commentPageResponseSchema = z
  .object({
    values: z.array(commentResponseSchema),
    next: z.string().min(1).nullish(),
  })
  .loose();

export const createCommentResponseSchema = z
  .object({
    id: z.number().int().positive(),
    content: z.object({ raw: optionalText }).nullish(),
  })
  .loose();
