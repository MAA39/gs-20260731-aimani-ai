import { createServerFn } from '@tanstack/react-start';
import { peopleInputSchema } from './people-schema';
import { getPeopleFromApi } from './people.server';
export const getPeople = createServerFn({ method: 'GET' }).inputValidator(peopleInputSchema).handler(({ data }) => getPeopleFromApi(data));
