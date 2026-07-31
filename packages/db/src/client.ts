import { Client } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
export type AimaniAiDatabase = NodePgDatabase<typeof schema>;
export interface DatabaseResource { client: Client; database: AimaniAiDatabase }

export function createNodePgDatabase(connectionString: string): DatabaseResource {
  const client = new Client({ connectionString });
  return { client, database: drizzle(client, { schema }) };
}
export async function closeNodePgDatabase(resource: { client: Client }): Promise<void> { await resource.client.end(); }
