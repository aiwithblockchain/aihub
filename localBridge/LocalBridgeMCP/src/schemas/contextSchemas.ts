import { z } from 'zod';
import { timeoutMsSchema } from './common.js';

export const listXInstancesInputSchema = z
  .object({
    timeoutMs: timeoutMsSchema.optional(),
  })
  .strict();

export type ListXInstancesInput = z.infer<typeof listXInstancesInputSchema>;
