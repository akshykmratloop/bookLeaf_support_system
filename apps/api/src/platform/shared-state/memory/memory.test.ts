import { sharedStateContract } from '../../../../test/helpers/shared-state-contract.js';
import { memoryBackend, memorySharedState } from './index.js';

/** The in-memory backend keeps the same promises as Redis, with a clock the test moves. */
sharedStateContract('memory', () => {
  let offset = 0;
  const backend = memoryBackend(() => Date.now() + offset);
  return {
    a: memorySharedState(backend),
    b: memorySharedState(backend),
    pass: async (ms) => {
      offset += ms;
    },
  };
});
