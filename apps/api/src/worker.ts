import { createApp } from './app';
import { createRootContainer } from './composition/root-container';

export default createApp({ rootContainer: createRootContainer() });
