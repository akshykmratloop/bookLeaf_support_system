import { Skeleton as Bones } from 'boneyard-js/react';
import type { ReactNode } from 'react';
import { Spinner } from './Spinner';

interface Props {
  /** Unique name; the captured shape is stored under it (src/bones). */
  name: string;
  loading: boolean;
  /** Example content the boneyard CLI measures to capture the shape. */
  fixture: ReactNode;
  children: ReactNode;
}

/**
 * Loading placeholder shaped like the real content (boneyard-js). Until a shape has been
 * captured, a spinner is shown instead.
 */
export function Skeleton({ name, loading, fixture, children }: Props) {
  return (
    <Bones
      name={name}
      loading={loading}
      fixture={fixture}
      color="var(--bone)"
      darkColor="var(--bone)"
      animate="shimmer"
      transition={180}
      fallback={
        <div className="flex justify-center py-12">
          <Spinner label="Loading…" />
        </div>
      }
    >
      {children}
    </Bones>
  );
}
