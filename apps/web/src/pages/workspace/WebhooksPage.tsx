import {
  MAX_WEBHOOKS_PER_WORKSPACE as MAX_WEBHOOKS,
  type CreateWebhookRequest,
  type Webhook,
} from '@bookleaf/shared';
import { Plus, Webhook as WebhookIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { OneTimeSecret } from '../../components/molecules/OneTimeSecret';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import {
  revealed,
  useWebhookActions,
  type RevealedSecret,
} from '../../components/organisms/useWebhookActions';
import { WebhookForm } from '../../components/organisms/WebhookForm';
import { WebhookRow } from '../../components/organisms/WebhookRow';
import { errorMessage, isApiError } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';
import { createWebhook, updateWebhook, useWebhooks, webhookKeys } from '../../lib/webhooks';

type Editing = { kind: 'new' } | { kind: 'edit'; webhook: Webhook } | null;

const secretText = (s: RevealedSecret) =>
  `${s.kind === 'created' ? 'Webhook added' : 'Secret replaced'} for ${s.url}. This is the only time it is shown: your server checks every delivery's X-BookLeaf-Signature with it.`;

function useSave(onCreated: (s: RevealedSecret) => void, onDone: () => void) {
  const toast = useToast();
  const save = useApiMutation(
    ({ id, input }: { id: string | null; input: CreateWebhookRequest }) =>
      id ? updateWebhook({ id, input }).then(() => null) : createWebhook(input),
    [webhookKeys.all],
  );
  const submit = (id: string | null, input: CreateWebhookRequest) =>
    save.mutate(
      { id, input },
      {
        onSuccess: (created) => {
          if (created) onCreated(revealed('created', created));
          else toast('success', 'Webhook saved');
          onDone();
        },
        onError: (e) => toast('error', errorMessage(e)),
      },
    );
  const fieldError = (p: string) => (isApiError(save.error) ? save.error.fieldError(p) : undefined);
  return { submit, fieldError, isSaving: save.isPending };
}

function WebhooksEditor({ webhooks }: { webhooks: Webhook[] }) {
  const [editing, setEditing] = useState<Editing>(null);
  const [secret, setSecret] = useState<RevealedSecret | null>(null);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const actions = useWebhookActions(setSecret);
  const save = useSave(setSecret, () => setEditing(null));
  const editingId = editing?.kind === 'edit' ? editing.webhook.id : null;
  const isFull = webhooks.length >= MAX_WEBHOOKS;
  return (
    <div className="grid max-w-[960px] gap-4">
      {secret ? (
        <OneTimeSecret
          title="Copy the signing secret now"
          body={secretText(secret)}
          secret={secret.secret}
          onDone={() => setSecret(null)}
        />
      ) : null}
      {editing ? (
        <Card className="p-5">
          <WebhookForm
            key={editingId ?? 'new'}
            initial={editing.kind === 'edit' ? editing.webhook : null}
            isSaving={save.isSaving}
            fieldError={save.fieldError}
            onSubmit={(input) => save.submit(editingId, input)}
            onCancel={() => setEditing(null)}
          />
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            icon={<Plus size={15} aria-hidden />}
            disabled={isFull}
            onClick={() => setEditing({ kind: 'new' })}
          >
            Add webhook
          </Button>
          {isFull ? (
            <p className="text-[12.5px] text-ink-3">
              A workspace can have {MAX_WEBHOOKS} webhooks. Delete one to add another.
            </p>
          ) : null}
        </div>
      )}
      <Card className="p-0">
        {webhooks.length === 0 ? (
          <EmptyState
            title="No webhooks yet"
            body="Add your server's address and it is told when a ticket is created, gets a staff reply, or changes status."
          />
        ) : (
          <ul>
            {webhooks.map((w) => (
              <WebhookRow
                key={w.id}
                w={w}
                actions={actions}
                isOpen={openLog === w.id}
                onOpenLog={() => setOpenLog((cur) => (cur === w.id ? null : w.id))}
                onEdit={() => setEditing({ kind: 'edit', webhook: w })}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function WebhooksPage() {
  const webhooks = useWebhooks();
  return (
    <>
      <PageHeader
        title="Webhooks"
        subtitle="Your server hears about ticket events as signed POST requests. Failed deliveries are retried 6 times."
        actions={<WebhookIcon size={18} aria-hidden className="text-ink-3" />}
      />
      {webhooks.isPending ? <LoadingState /> : null}
      {webhooks.isError ? (
        <ErrorState error={webhooks.error} onRetry={() => void webhooks.refetch()} />
      ) : null}
      {webhooks.data ? <WebhooksEditor webhooks={webhooks.data} /> : null}
    </>
  );
}
