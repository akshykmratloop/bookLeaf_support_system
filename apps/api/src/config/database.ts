import { z } from 'zod';

/** The support module's own Postgres database. */
export const DatabaseConfig = z.object({
  DATABASE_URL: z.string().startsWith('postgres'),
});
