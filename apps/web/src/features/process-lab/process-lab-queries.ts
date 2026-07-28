import { queryOptions } from '@tanstack/react-query';
import { getProcessLab } from './process-lab.functions';
import { processLabKey } from './process-lab-query-key';

export { processLabKey } from './process-lab-query-key';

export const processLabQuery = (organizationId: string) =>
  queryOptions({
    queryKey: processLabKey(organizationId),
    queryFn: () => getProcessLab({ data: { organizationId } }),
  });
