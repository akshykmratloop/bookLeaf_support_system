import type { Connector } from '@bookleaf/shared';
import { PlugZap } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';
import { testConnector, workspaceKeys } from '../../lib/workspace';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Input } from '../atoms/Input';
import { Pill } from '../atoms/Pill';
import { Field } from '../molecules/Field';

/** Fetches one customer from the product with the saved key, the way the assistant will. */
export function TestConnection({ connector }: { connector: Connector }) {
  const [customerId, setCustomerId] = useState('');
  const test = useApiMutation(testConnector, [workspaceKeys.connector]);
  const result = test.data ?? connector.lastTest;
  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="text-[15px] font-semibold">Test the connection</p>
      <p className="text-[12.5px] text-ink-2">
        We fetch one customer from your product with the saved key, the way the assistant will.
      </p>
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Field id="test-customer" label="A customer id your product knows">
            <Input
              id="test-customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </Field>
        </div>
        <Button
          variant="secondary"
          icon={<PlugZap size={15} aria-hidden />}
          isLoading={test.isPending}
          disabled={!customerId || !connector.configured}
          onClick={() => test.mutate(customerId)}
        >
          Test
        </Button>
      </div>
      {test.isError ? (
        <p className="text-[12.5px] text-danger">{errorMessage(test.error)}</p>
      ) : null}
      {result ? (
        <p className="flex items-center gap-2 text-[12.5px]">
          <Pill tone={result.ok ? 'success' : 'danger'} dot>
            {result.ok ? 'Connected' : 'Failed'}
          </Pill>
          <span className="text-ink-2">{result.detail}</span>
        </p>
      ) : null}
    </Card>
  );
}
