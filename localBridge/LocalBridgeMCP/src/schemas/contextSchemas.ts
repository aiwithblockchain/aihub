import { z } from 'zod';
import { timeoutMsSchema } from './common.js';

const instanceIdSchema = z.string().min(1);

export const listXInstancesInputSchema = z
  .object({
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type ListXInstancesInput = z.infer<typeof listXInstancesInputSchema>;

export const getXStatusInputSchema = z
  .object({
    instanceId: instanceIdSchema.optional(),
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetXStatusInput = z.infer<typeof getXStatusInputSchema>;

export const getXBasicInfoInputSchema = z
  .object({
    instanceId: instanceIdSchema.optional(),
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetXBasicInfoInput = z.infer<typeof getXBasicInfoInputSchema>;

export const getHomeTimelineInputSchema = z
  .object({
    instanceId: instanceIdSchema.optional(),
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetHomeTimelineInput = z.infer<typeof getHomeTimelineInputSchema>;

export const getTweetInputSchema = z
  .object({
    tweetId: z.string().min(1),
    instanceId: instanceIdSchema.optional(),
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetTweetInput = z.infer<typeof getTweetInputSchema>;

export const getTweetRepliesInputSchema = z
  .object({
    tweetId: z.string().min(1),
    cursor: z.string().min(1).optional(),
    instanceId: instanceIdSchema.optional(),
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetTweetRepliesInput = z.infer<typeof getTweetRepliesInputSchema>;

export const getUserProfileInputSchema = z
  .object({
    screenName: z.string().min(1),
    instanceId: instanceIdSchema.optional(),
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type GetUserProfileInput = z.infer<typeof getUserProfileInputSchema>;
