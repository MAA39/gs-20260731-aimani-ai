import { resolveDatabaseUrl, type ApiBindings } from '../config/env';
import { seedDemoData } from '../demo/seed-demo-data';

const env = process.env as unknown as ApiBindings;
await seedDemoData(resolveDatabaseUrl(env));
