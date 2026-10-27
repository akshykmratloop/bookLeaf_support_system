import { useQuery } from '@tanstack/react-query';
import type {
  Connector,
  ConnectorTestResult,
  CustomerField,
  CustomerFieldInput,
  MyWorkspace,
  SaveConnectorRequest,
  SignupRequest,
  SignupResponse,
  UpdateWorkspaceSettings,
  WorkspaceSettings,
  WorkspaceSettingsStatus,
} from '@bookleaf/shared';
import { api } from './api';

export const workspaceKeys = {
  mine: ['workspace', 'mine'] as const,
  connector: ['workspace', 'connector'] as const,
  fields: ['workspace', 'fields'] as const,
  settings: ['workspace', 'settings'] as const,
};

export const useMyWorkspace = () =>
  useQuery({ queryKey: workspaceKeys.mine, queryFn: () => api<MyWorkspace>('/workspace') });

export const useConnector = () =>
  useQuery({
    queryKey: workspaceKeys.connector,
    queryFn: () => api<Connector>('/workspace/connector'),
  });

export const useCustomerFields = () =>
  useQuery({
    queryKey: workspaceKeys.fields,
    queryFn: () => api<{ items: CustomerField[] }>('/workspace/fields').then((r) => r.items),
  });

export const useWorkspaceSettings = () =>
  useQuery({
    queryKey: workspaceKeys.settings,
    queryFn: () => api<WorkspaceSettingsStatus>('/workspace/settings'),
  });

export const signup = (input: SignupRequest) =>
  api<SignupResponse>('/signup', { method: 'POST', body: input });

export const saveConnector = (input: SaveConnectorRequest) =>
  api<Connector>('/workspace/connector', { method: 'PUT', body: input });

export const testConnector = (customerId: string) =>
  api<ConnectorTestResult>('/workspace/connector/test', { method: 'POST', body: { customerId } });

export const createField = (input: CustomerFieldInput) =>
  api<CustomerField>('/workspace/fields', { method: 'POST', body: input });

export const updateField = (id: string, input: CustomerFieldInput) =>
  api<CustomerField>(`/workspace/fields/${id}`, { method: 'PUT', body: input });

export const deleteField = (id: string) =>
  api<void>(`/workspace/fields/${id}`, { method: 'DELETE' });

export const saveWorkspaceSettings = (input: UpdateWorkspaceSettings) =>
  api<WorkspaceSettings>('/workspace/settings', { method: 'PUT', body: input });

/** A workspace slug suggested from its name: lowercase, hyphens, 3–40 characters. */
export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}
