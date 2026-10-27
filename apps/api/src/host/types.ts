import type { HostCustomer } from '@bookleaf/shared';

/**
 * The one thing the support module asks the host product: what it knows about a customer.
 * Core code depends on this interface only; adapters live in host/<name>/.
 */
export interface HostRecords {
  /**
   * Throws HostUnavailableError when the host cannot answer, CustomerNotFoundError on 404.
   * `workspaceId` picks that workspace's connector; omitted = the default workspace.
   */
  customer(externalId: string, workspaceId?: string): Promise<HostCustomer>;
}
