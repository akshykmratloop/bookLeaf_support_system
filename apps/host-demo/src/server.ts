import { buildHostApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await buildHostApp(config);
await app.listen({ port: config.HOST_DEMO_PORT, host: '0.0.0.0' });
console.info(`BookLeaf demo host on http://localhost:${config.HOST_DEMO_PORT}`);
