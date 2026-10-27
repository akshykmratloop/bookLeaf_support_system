import { z } from 'zod';
import { FactSchema } from './facts.js';

/**
 * The contract between the support module and the product it is attached to (the "host").
 * The host signs its user in with a short token and serves one endpoint with what it knows
 * about that customer, as verified facts. See docs/integration.md.
 */
export const HOST_TOKEN_AUDIENCE = 'support';
/** A host token is a one-time hand-over, so it must expire within five minutes of being made. */
export const HOST_TOKEN_MAX_SECONDS = 300;

/** A customer or item id in the host: letters, digits and `. _ @ : -`, never "." or "..". */
const externalId = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^(?!\.{1,2}$)[\w.@:-]+$/, 'not a valid id');

export const HostTokenClaimsSchema = z.object({
  sub: externalId,
  /** A unique id per token; each token signs in once. */
  jti: z.string().trim().min(8).max(100),
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  iat: z.int(),
  exp: z.int(),
});
export type HostTokenClaims = z.infer<typeof HostTokenClaimsSchema>;

export const HostSignInRequestSchema = z.object({ token: z.string().min(20).max(4000) });

/** A line shown to the customer as it is, e.g. { label: "Royalty pending", display: "₹3,570" }. */
export const HostDetailSchema = z.object({
  label: z.string().trim().min(1).max(80),
  display: z.string().trim().min(1).max(300),
});
export type HostDetail = z.infer<typeof HostDetailSchema>;

/**
 * Something the customer has with the host (for BookLeaf: a book). `facts` are for the
 * assistant (verified, with sources); `details` are what the customer sees on the page.
 */
export const HostItemSchema = z.object({
  id: externalId,
  title: z.string().trim().min(1).max(300),
  facts: z.array(FactSchema).max(200),
  details: z.array(HostDetailSchema).max(30).default([]),
});
export type HostItem = z.infer<typeof HostItemSchema>;

/** `GET {HOST_API_URL}/support/customers/{id}`: everything the assistant may use. */
export const HostCustomerSchema = z.object({
  id: externalId,
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  items: z.array(HostItemSchema).max(100),
  /** Account-level facts (totals, policies). */
  facts: z.array(FactSchema).max(200),
  /** Account-level lines to show the customer (e.g. totals). */
  details: z.array(HostDetailSchema).max(30).default([]),
});
export type HostCustomer = z.infer<typeof HostCustomerSchema>;
