import { useQuery } from '@tanstack/react-query';
import type {
  CreateCustomer,
  CustomerList,
  PlanStatus,
  PlatformAdmin,
  PlatformAiSettings,
  PlatformAiStatus,
  ProviderCapability,
  UpdatePlan,
  UpdatePlatformAiSettings,
} from '@bookleaf/shared';
import { api } from './api';

/**
 * The super admin console's API (U-7). Its own cookie and its own query keys: nothing here is
 * shared with the customer screens' cache.
 */
export const platformKeys = {
  me: ['platform', 'me'] as const,
  ai: ['platform', 'ai'] as const,
  customers: ['platform', 'customers'] as const,
};

const P = '/platform';

export const usePlatformMe = () =>
  useQuery({
    queryKey: platformKeys.me,
    queryFn: () => api<{ admin: PlatformAdmin }>(`${P}/auth/me`).then((r) => r.admin),
    retry: false,
  });

export const usePlatformAi = () =>
  useQuery({ queryKey: platformKeys.ai, queryFn: () => api<PlatformAiStatus>(`${P}/ai`) });

export const useCustomers = () =>
  useQuery({
    queryKey: platformKeys.customers,
    queryFn: () => api<CustomerList>(`${P}/customers`),
  });

export const platformSignIn = (email: string, password: string) =>
  api<{ admin: PlatformAdmin }>(`${P}/auth/login`, { method: 'POST', body: { email, password } });

export const platformSignOut = () => api<void>(`${P}/auth/logout`, { method: 'POST' });

export const savePlatformAi = (input: UpdatePlatformAiSettings) =>
  api<PlatformAiSettings>(`${P}/ai/settings`, { method: 'PUT', body: input });

export const savePlatformKey = (input: {
  capability: ProviderCapability;
  provider: string;
  apiKey: string;
}) =>
  api<PlatformAiStatus>(`${P}/ai/keys/${input.capability}/${input.provider}`, {
    method: 'PUT',
    body: { apiKey: input.apiKey },
  });

export const removePlatformKey = (input: { capability: ProviderCapability; provider: string }) =>
  api<void>(`${P}/ai/keys/${input.capability}/${input.provider}`, { method: 'DELETE' });

export const testPlatformAi = () =>
  api<{ ok: boolean; detail: string }>(`${P}/ai/test`, { method: 'POST' });

export const createCustomer = (input: CreateCustomer) =>
  api<{ id: string; slug: string }>(`${P}/customers`, { method: 'POST', body: input });

export const updateCustomerPlan = ({ id, ...input }: UpdatePlan & { id: string }) =>
  api<PlanStatus>(`${P}/customers/${id}/plan`, { method: 'PUT', body: input });

/** Micro-dollars as money: "$0.42", "<$0.01" for tiny non-zero amounts. */
export function formatCost(micros: number): string {
  if (micros === 0) return '$0.00';
  const dollars = micros / 1_000_000;
  if (dollars < 0.01) return '<$0.01';
  return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
