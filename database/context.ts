/**
 * Database Context - Async local storage for database connection
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';

export type Database = PostgresJsDatabase<typeof schema>;

export const DatabaseContext = new AsyncLocalStorage<Database>();

export function getDatabase(): Database {
  const db = DatabaseContext.getStore();
  if (!db) {
    throw new Error('Database not available in current context');
  }
  return db;
}
