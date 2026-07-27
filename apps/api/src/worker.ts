import { createApp } from './app';
import { createRootContainer } from './composition/root-container';
import type { ApiBindings } from './config/env';

export default createApp({ rootContainer: createRootContainer() });
