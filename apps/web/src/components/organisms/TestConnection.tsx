import type { Connector, ConnectorTestResult } from '@bookleaf/shared';
import { PlugZap } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../lib/api';
import { useApiMutation } from '../../lib/queries';
import { testConnector, workspaceKeys } from '../../lib/workspace';
import { Button } from '../atoms/Button';
import { Card } from '../atoms/Card';
import { Input } from '../atoms/Input';
import { Pill } from '../atoms/Pill';
import { Field } from '../molecules/Field';
import { MappedPreview } from '../molecules/MappedPreview';
import { SourceProbeList } from '../molecules/SourceProbeList';

/** The result line, then (for a test run just now) each source's answer and the preview. */
function TestOutcome({
  last,
  data,
}: {
  last: Connector['lastTest'];
  data: ConnectorTestResult | undefined;
}) {
  const result = data ?? last;
  if (!result) return null;
  return (
    <>
      <p className="flex flex-wrap items-center gap-2 text-[12.5px]" aria-live="polite">
        <Pill tone={result.ok ? 'success' : 'danger'} dot>
          {result.ok ? 'Connected' : 'Failed'}
        </Pill>
        <span className="text-ink-2">{result.detail}</span>
      </p>
      {data ? <SourceProbeList probes={data.sources} /> : null}
      {data?.preview ? <MappedPreview preview={data.preview} /> : null}
    </>
  );
}

/**
 * Calls every data source for one customer with the saved key, the way support will, and shows
 * each raw answer plus the merged record (U-9). Nothing is saved except the last result line.
 */
export function TestConnection({ connector }: { connector: Connector }) {
  const [customerId, setCustomerId] = useState('');
  const [email, setEmail] = useState('');
  const test = useApiMutation(testConnector, [workspaceKeys.connector]);
  const usesEmail = connector.sources.some((s) => s.urlTemplate.includes('{email}'));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    test.mutate({
      customerId: customerId.trim(),
      ...(email.trim() ? { email: email.trim() } : {}),
    });
  };
  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="text-[15px] font-semibold">Test the connection</p>
      <p className="text-[12.5px] text-ink-2">
        We call each data source for one customer with the saved key and show what came back.
      </p>
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2" noValidate>
        <div className="min-w-[12rem] flex-1">
          <Field id="test-customer" label="A customer id your product knows">
            <Input
              id="test-customer"
              value={customerId}
              maxLength={100}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </Field>
        </div>
        {usesEmail ? (
          <div className="min-w-[12rem] flex-1">
            <Field id="test-email" label="Their email (fills {email})">
              <Input
                id="test-email"
                type="email"
                value={email}
                maxLength={254}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
        ) : null}
        <Button
          type="submit"
          variant="secondary"
          icon={<PlugZap size={15} aria-hidden />}
          isLoading={test.isPending}
          disabled={!customerId.trim() || !connector.configured}
        >
          Test
        </Button>
      </form>
      {test.isError ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {errorMessage(test.error)}
        </p>
      ) : null}
      <TestOutcome last={connector.lastTest} data={test.data} />
    </Card>
  );
}
