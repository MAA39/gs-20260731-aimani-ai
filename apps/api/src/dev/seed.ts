import { resolveDatabaseUrl, type ApiBindings } from '../config/env';
import { seedDevelopmentData } from './seed-development-data';

const env = process.env as unknown as ApiBindings;
await seedDevelopmentData(resolveDatabaseUrl(env));
