import {
  WEBHOOK_EVENTS,
  type CreateWebhookRequest,
  type Webhook,
  type WebhookEvent,
} from '@bookleaf/shared';
import { useState, type FormEvent } from 'react';
import { eventLabel, withEvent } from '../../lib/webhookView';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { CheckboxField } from '../molecules/CheckboxField';
import { Field } from '../molecules/Field';

const isEvent = (e: string): e is WebhookEvent => (WEBHOOK_EVENTS as readonly string[]).includes(e);

interface Props {
  initial: Webhook | null;
  isSaving: boolean;
  fieldError: (path: string) => string | undefined;
  onSubmit: (input: CreateWebhookRequest) => void;
  onCancel: () => void;
}

/** Add or edit a webhook: the address that receives events, and which events it gets. */
export function WebhookForm({ initial, isSaving, fieldError, onSubmit, onCancel }: Props) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [events, setEvents] = useState<WebhookEvent[]>(
    initial ? initial.events.filter(isEvent) : [...WEBHOOK_EVENTS],
  );
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ url: url.trim(), events });
  };
  const eventsError = fieldError('events');
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field
        id="webhook-url"
        label="Address that receives the events"
        hint="https only in production. Internal and private addresses are refused."
        error={fieldError('url')}
      >
        <Input
          id="webhook-url"
          name="url"
          type="url"
          inputMode="url"
          maxLength={2048}
          placeholder="https://your-product.example/hooks/support"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-[12.5px] font-semibold text-ink-2">Send these events</legend>
        {WEBHOOK_EVENTS.map((event) => (
          <CheckboxField
            key={event}
            id={`webhook-event-${event}`}
            name="events"
            checked={events.includes(event)}
            label={`${eventLabel(event)} (${event})`}
            onChange={(on) => setEvents((prev) => withEvent(prev, event, on))}
          />
        ))}
        {eventsError ? (
          <p role="alert" className="text-[12px] text-danger">
            {eventsError}
          </p>
        ) : null}
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" isLoading={isSaving} disabled={!url.trim() || events.length === 0}>
          {initial ? 'Save webhook' : 'Add webhook'}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
