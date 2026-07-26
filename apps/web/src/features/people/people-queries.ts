import { queryOptions } from '@tanstack/react-query';
import { getPeople } from './people.functions';
export const peopleKey = (organizationId: string) => ['people', organizationId] as const;
export const peopleQuery = (organizationId: string) => queryOptions({ queryKey: peopleKey(organizationId), queryFn: () => getPeople({ data: { organizationId } }) });
