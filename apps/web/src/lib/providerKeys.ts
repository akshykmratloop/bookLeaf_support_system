import { useQuery } from '@tanstack/react-query';
import type {
  ProviderCapability,
  ProviderKey,
  ProviderKeyList,
  SaveProviderKey,
} from '@bookleaf/shared';
import { api } from './api';

export const providerKeysKey = ['workspace', 'provider-keys'] as const;

export const useProviderKeys = () =>
  useQuery({
    queryKey: providerKeysKey,
    queryFn: () => api<ProviderKeyList>('/workspace/provider-keys'),
  });

export const saveProviderKey = ({
  capability,
  ...input
}: SaveProviderKey & { capability: ProviderCapability }) =>
  api<ProviderKey>(`/workspace/provider-keys/${capability}`, { method: 'PUT', body: input });

export const removeProviderKey = (capability: ProviderCapability) =>
  api<void>(`/workspace/provider-keys/${capability}`, { method: 'DELETE' });
