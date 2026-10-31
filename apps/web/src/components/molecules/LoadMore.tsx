import { Button } from '../atoms/Button';

interface Props {
  /** The list has more pages on the server. */
  hasMore: boolean;
  isLoading: boolean;
  onLoad: () => void;
  /** What the button loads, e.g. "tickets". */
  noun: string;
}

/** "Load more" under a list read page by page; nothing when every page is loaded. */
export function LoadMore({ hasMore, isLoading, onLoad, noun }: Props) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center p-4">
      <Button variant="secondary" isLoading={isLoading} disabled={isLoading} onClick={onLoad}>
        {isLoading ? `Loading more ${noun}…` : `Load more ${noun}`}
      </Button>
    </div>
  );
}
