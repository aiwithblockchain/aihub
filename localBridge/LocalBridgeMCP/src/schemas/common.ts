import { z } from 'zod';

export const timeoutMsSchema = z.number().int().positive().max(300000);
export const instanceIdSchema = z.string().min(1);
export const tabIdSchema = z.string().min(1);
