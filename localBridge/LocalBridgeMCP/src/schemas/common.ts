import { z } from 'zod';

export const timeoutMsSchema = z.number().int().positive().max(300000);
export const instanceIdSchema = z.string().min(1);
export const tabIdSchema = z.number().int().positive();
export const countSchema = z.number().int().positive();
export const cursorSchema = z.string().min(1);
