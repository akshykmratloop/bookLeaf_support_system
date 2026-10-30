import type { Connector } from '@bookleaf/shared';
import { Link } from 'react-router';
import { mappableSources } from '../../lib/dataSources';
import { Card } from '../atoms/Card';
import { RecordMappingForm } from './RecordMappingForm';
import { TestConnection } from './TestConnection';

const CONNECTION_PATH = '/admin/workspace/connection';

/**
 * The Customer data page's mapping half (U-9): where name, email and the item list come from,
 * and the Test panel with each source's raw answer and the merged preview.
 */
export function CustomerRecordSection({ connector }: { connector: Connector }) {
  const canMap = connector.source === 'WORKSPACE' && mappableSources(connector.sources).length > 0;
  return (
    <div className="grid gap-4">
      {canMap ? (
        <RecordMappingForm key={connector.version} connector={connector} />
      ) : (
        <Card className="p-5 text-[12.5px] text-ink-2">
          <p className="text-[15px] font-semibold text-ink">Where the customer record comes from</p>
          <p className="mt-1">
            Your data comes from one endpoint in the full customer shape. To read fields from other
            APIs, add data sources on the{' '}
            <Link to={CONNECTION_PATH} className="font-semibold text-brand-ink underline">
              Product connection
            </Link>{' '}
            page and save it.
          </p>
        </Card>
      )}
      <TestConnection connector={connector} />
    </div>
  );
}
