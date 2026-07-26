import { Client } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';

export function createNodePgDatabase(connectionString: string): { client: Client; db: NodePgDatabase<typeof schema> } {
  const client = new Client({ connectionString });
  return { client, db: drizzle(client, { schema }) };
}
export async function closeNodePgDatabase(resource: { client: Client }): Promise<void> { await resource.client.end(); }
