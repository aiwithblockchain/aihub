import { z } from 'zod';
import { timeoutMsSchema } from './common.js';

export const listXInstancesInputSchema = z
  .object({
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type ListXInstancesInput = z.infer<typeof listXInstancesInputSchema>;

export const getXStatusInputSchema = z
  .object({
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetXStatusInput = z.infer<typeof getXStatusInputSchema>;

export const getXBasicInfoInputSchema = z
  .object({
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetXBasicInfoInput = z.infer<typeof getXBasicInfoInputSchema>;

export const getHomeTimelineInputSchema = z
  .object({
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetHomeTimelineInput = z.infer<typeof getHomeTimelineInputSchema>;

export const getTweetInputSchema = z
  .object({
    tweetId: z.string().min(1),
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetTweetInput = z.infer<typeof getTweetInputSchema>;
