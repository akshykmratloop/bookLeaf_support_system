import { Card } from '../../components/atoms/Card';
import { Button } from '../../components/atoms/Button';
import { ConversationRow } from '../../components/molecules/ConversationRow';
import { PageHeader } from '../../components/molecules/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '../../components/molecules/States';
import { errorMessage } from '../../lib/api';
import { useConversations } from '../../lib/conversations';

/** Every past chat and call, newest first, so the author can see what they asked and when. */
export function HistoryPage() {
  const list = useConversations();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageHeader
        title="History"
        subtitle="Your past chats and calls with Ask BookLeaf. Open one to read it again."
      />
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
      {items.length > 0 ? (
        <Card>
          <ul className="divide-y divide-line">
            {items.map((c) => (
              <li key={c.id}>
                <ConversationRow conversation={c} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {list.hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="secondary"
            isLoading={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          >
            Show older
          </Button>
        </div>
      ) : null}
    </>
  );
}
