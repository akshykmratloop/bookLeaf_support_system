/** What the support module's tests use to run a real host next to them. */
export { buildHostApp } from './app.js';
export { loadConfig, type HostConfig } from './config.js';
export { findByEmail, loadAuthors, type AuthorAccount } from './data/authors.js';
export { toCustomer } from './customers.js';
export { buildFactsPack, type AuthorRecord } from './facts/index.js';
export { mintSupportToken } from './tokens.js';
