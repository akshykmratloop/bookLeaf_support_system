import type { OnboardingTestTicket } from '@bookleaf/shared';
import { ExternalLink, Send } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '../atoms/Button';
import { useToast } from '../molecules/Toast';
import { errorMessage } from '../../lib/api';
import { onboardingKeys, sendTestTicket } from '../../lib/onboarding';
import { widgetPreviewUrl } from '../../lib/onboardingSteps';
import { useApiMutation } from '../../lib/queries';

interface Props {
  supportUrl: string;
  slug: string;
  /** The latest test ticket, if one was sent. */
  last: OnboardingTestTicket | null;
}

/** "Test it": send a test ticket into the queue, or open the widget page to try it. */
export function TestTicketActions({ supportUrl, slug, last }: Props) {
  const toast = useToast();
  const send = useApiMutation(sendTestTicket, [onboardingKeys.status, ['tickets']]);
  const onSend = () =>
    send.mutate(undefined, {
      onSuccess: (t) => toast('success', `Test ticket ${t.label} sent to your queue`),
      onError: (e) => toast('error', errorMessage(e)),
    });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          icon={<Send size={14} aria-hidden />}
          isLoading={send.isPending}
          onClick={onSend}
        >
          Send a test ticket
        </Button>
        <a
          href={widgetPreviewUrl(supportUrl, slug)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-control px-3 text-[12.5px] font-semibold text-ink-2 hover:bg-panel-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
        >
          Preview the widget <ExternalLink size={12} aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
      {last ? (
        <p className="text-[12.5px] text-ink-2">
          Last test ticket:{' '}
          <Link to={`/admin/tickets/${last.id}`} className="font-semibold text-brand-ink underline">
            {last.label}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
