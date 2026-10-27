import type { AuthorTicket } from '@bookleaf/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Card } from '../../components/atoms/Card';
import { PageHeader } from '../../components/molecules/PageHeader';
import { ErrorState, LoadingState } from '../../components/molecules/States';
import { useToast } from '../../components/molecules/Toast';
import { TicketForm, type TicketFormValues } from '../../components/organisms/TicketForm';
import { api, errorMessage, isApiError } from '../../lib/api';
import { newRequestKey } from '../../lib/ids';
import { keys, useApiMutation, useBooks } from '../../lib/queries';

export function NewTicketPage() {
  const books = useBooks();
  const navigate = useNavigate();
  const toast = useToast();
  // One key per form: a double-click or a retry after a network blip creates one ticket, not two.
  const [requestKey] = useState(newRequestKey);
  const create = useApiMutation(
    (values: TicketFormValues) =>
      api<AuthorTicket>('/tickets', { method: 'POST', body: values, idempotencyKey: requestKey }),
    [keys.tickets()],
  );
  const submit = (values: TicketFormValues) =>
    create.mutate(values, {
      onSuccess: (ticket) => {
        toast('success', `Ticket ${ticket.number} received. We'll reply here.`);
        navigate(`/tickets/${ticket.id}`);
      },
    });
  const serverError = (path: string) =>
    isApiError(create.error) ? create.error.fieldError(path) : undefined;
  const generalError =
    create.error && !(isApiError(create.error) && create.error.problem.errors?.length)
      ? errorMessage(create.error)
      : null;
  return (
    <>
      <PageHeader
        title="New support ticket"
        subtitle="Tell us what's going on. Our team usually replies within one working day."
      />
      <Card className="max-w-[760px] p-6">
        {books.isPending ? <LoadingState /> : null}
        {books.isError ? (
          <ErrorState message={errorMessage(books.error)} onRetry={() => void books.refetch()} />
        ) : null}
        {books.data ? (
          <TicketForm
            books={books.data}
            isSubmitting={create.isPending}
            serverError={serverError}
            onSubmit={submit}
          />
        ) : null}
        {generalError ? (
          <p
            role="alert"
            className="mt-4 rounded-control bg-danger-bg px-3 py-2 text-[13px] text-danger"
          >
            {generalError}
          </p>
        ) : null}
      </Card>
    </>
  );
}
