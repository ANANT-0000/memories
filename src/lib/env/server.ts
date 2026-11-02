import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  GALLERY_PIN: z.string().default('1234'),
  ADMIN_PIN: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export const serverEnv = serverEnvSchema.parse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GALLERY_PIN: process.env.GALLERY_PIN,
  ADMIN_PIN: process.env.ADMIN_PIN,
  NODE_ENV: process.env.NODE_ENV,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
