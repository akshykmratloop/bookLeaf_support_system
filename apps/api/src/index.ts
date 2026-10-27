/**
 * What a Node host imports to attach the support module to its own Fastify server:
 *
 *   import { loadEnv, supportPlugin } from '@bookleaf/api';
 *   await app.register(supportPlugin, { prefix: '/support', env: loadEnv() });
 */
export { supportPlugin, type SupportPluginOptions } from './plugin.js';
export { loadEnv, type Env } from './config/index.js';
