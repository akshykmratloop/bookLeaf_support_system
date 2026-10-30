import type { CreatedWebhook, Webhook } from '@bookleaf/shared';
import { useToast } from '../molecules/Toast';
import { errorMessage } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';
import {
  deleteWebhook,
  rotateWebhookSecret,
  sendWebhookTest,
  updateWebhook,
  webhookKeys,
} from '../../lib/webhooks';

/** A signing secret to show once, and why it is being shown. */
export interface RevealedSecret {
  kind: 'created' | 'rotated';
  url: string;
  secret: string;
}

export const revealed = (kind: RevealedSecret['kind'], r: CreatedWebhook): RevealedSecret => ({
  kind,
  url: r.webhook.url,
  secret: r.signingSecret,
});

/** The per-row actions on the Webhooks page; every one of them is also checked by the server. */
export function useWebhookActions(onSecret: (s: RevealedSecret) => void) {
  const toast = useToast();
  const onError = (e: unknown) => toast('error', errorMessage(e));
  // One prefix: refreshes the list and every open delivery log.
  const all = [webhookKeys.all];
  const rotate = useApiMutation(rotateWebhookSecret, all);
  const test = useApiMutation(sendWebhookTest, all);
  const toggle = useApiMutation(updateWebhook, all);
  const remove = useApiMutation(deleteWebhook, all);
  return {
    busy: rotate.isPending || test.isPending || toggle.isPending || remove.isPending,
    rotate(w: Webhook) {
      const ask = 'Replace the signing secret? Your server must use the new one from now on.';
      if (!window.confirm(ask)) return;
      rotate.mutate(w.id, { onSuccess: (r) => onSecret(revealed('rotated', r)), onError });
    },
    test(w: Webhook) {
      test.mutate(w.id, { onSuccess: () => toast('success', 'Test delivery queued'), onError });
    },
    toggle(w: Webhook) {
      const done = w.active ? 'Webhook switched off' : 'Webhook switched on';
      toggle.mutate(
        { id: w.id, input: { active: !w.active } },
        { onSuccess: () => toast('success', done), onError },
      );
    },
    remove(w: Webhook) {
      if (!window.confirm(`Delete the webhook for ${w.url}? Its delivery log goes too.`)) return;
      remove.mutate(w.id, { onSuccess: () => toast('success', 'Webhook deleted'), onError });
    },
  };
}

export type WebhookActions = ReturnType<typeof useWebhookActions>;
