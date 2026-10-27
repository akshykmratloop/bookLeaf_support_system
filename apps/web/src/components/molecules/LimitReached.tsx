import { MessageSquarePlus } from 'lucide-react';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';

interface Props {
  maxTurns: number;
  isRestarting: boolean;
  onRestart: () => void;
}

/** Takes the composer's place once the conversation has used all its messages. */
export function LimitReached({ maxTurns, isRestarting, onRestart }: Props) {
  return (
    <Card
      variant="elevated"
      role="status"
      className="sticky bottom-0 mt-auto flex flex-wrap items-center justify-between gap-3 p-4"
    >
      <div className="min-w-0">
        <p className="text-[14px] font-bold">
          This conversation reached its {maxTurns}-message limit
        </p>
        <p className="text-[12.5px] text-ink-2">
          It is paused here. Start a new conversation to keep going; this one stays in your History.
        </p>
      </div>
      <Button
        onClick={onRestart}
        isLoading={isRestarting}
        icon={<MessageSquarePlus size={14} aria-hidden />}
      >
        New conversation
      </Button>
    </Card>
  );
}
