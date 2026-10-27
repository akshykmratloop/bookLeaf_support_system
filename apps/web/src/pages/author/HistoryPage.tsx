import { Button } from '../../components/atoms/Button';
import { Card } from '../../components/atoms/Card';
import { ConversationRow } from '../../components/molecules/ConversationRow';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { errorMessage } from '../../lib/api';
import { useConversations } from '../../lib/conversations';
import { groupByDay } from '../../lib/dayGroups';

/** Every past chat and call, newest first, grouped by day. */
export function HistoryPage() {
  const list = useConversations();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const days = groupByDay(items, (c) => c.startedAt);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[20px] font-bold lg:text-[24px]">History</h1>
        <p className="text-[12.5px] text-ink-2">
          Your chats and calls with Ask BookLeaf. Open one to read it again.
        </p>
      </div>
      {list.isPending ? <LoadingState label="Loading your conversations…" /> : null}
      {list.isError ? (
        <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />
      ) : null}
      {list.data && items.length === 0 ? (
        <Card>
          <EmptyState
            title="No conversations yet"
            body="Chats and calls with Ask BookLeaf will be listed here."
          />
        </Card>
      ) : null}
      <ol className="flex flex-col gap-5">
        {days.map((day) => (
          <li key={day.label} className="animate-fade-up">
            <h2 className="mb-2 flex items-center gap-2 text-[12px] font-bold tracking-wide text-ink-3 uppercase">
              <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
              {day.label}
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-panel shadow-soft">
              {day.items.map((c) => (
                <li key={`${c.kind}-${c.id}`}>
                  <ConversationRow conversation={c} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {list.hasNextPage ? (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            pill
            isLoading={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            Show older
          </Button>
        </div>
      ) : null}
    </div>
  );
}
