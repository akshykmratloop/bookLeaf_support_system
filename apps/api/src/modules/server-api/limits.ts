/**
 * Server API rate limits, per calling address and per minute, counted in shared state so every
 * copy of the API adds up to one limit (F-19). Writes are lower: each new ticket starts AI work.
 */
export const SERVER_READS_PER_MINUTE = 120;
export const SERVER_WRITES_PER_MINUTE = 60;
