import type {
  QueryDatabaseParameters,
} from '@notionhq/client/build/src/api-endpoints.js';

export const VIEW_KEYS = ['inbox', 'today', 'upcoming', 'anytime', 'someday', 'logbook'] as const;
export type ViewKey = (typeof VIEW_KEYS)[number];

export function isViewKey(v: string): v is ViewKey {
  return (VIEW_KEYS as readonly string[]).includes(v);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type Filter = NonNullable<QueryDatabaseParameters['filter']>;
type Sort = NonNullable<QueryDatabaseParameters['sorts']>[number];

export function filterForView(view: ViewKey): { filter: Filter; sorts: Sort[] } {
  const today = todayISO();

  switch (view) {
    case 'inbox':
      return {
        filter: { property: 'Status', status: { equals: 'Inbox' } },
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      };

    case 'today':
      return {
        filter: {
          and: [
            { property: 'Status', status: { does_not_equal: 'Done' } },
            { property: 'Status', status: { does_not_equal: 'Cancelled' } },
            {
              or: [
                { property: 'Status', status: { equals: 'Today' } },
                { property: 'When', date: { on_or_before: today } },
              ],
            },
          ],
        },
        sorts: [{ property: 'When', direction: 'ascending' }],
      };

    case 'upcoming':
      return {
        filter: {
          and: [
            { property: 'When', date: { after: today } },
            { property: 'Status', status: { does_not_equal: 'Done' } },
            { property: 'Status', status: { does_not_equal: 'Cancelled' } },
          ],
        },
        sorts: [{ property: 'When', direction: 'ascending' }],
      };

    case 'anytime':
      return {
        filter: { property: 'Status', status: { equals: 'Anytime' } },
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      };

    case 'someday':
      return {
        filter: { property: 'Status', status: { equals: 'Someday' } },
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      };

    case 'logbook':
      return {
        filter: {
          or: [
            { property: 'Status', status: { equals: 'Done' } },
            { property: 'Status', status: { equals: 'Cancelled' } },
          ],
        },
        sorts: [{ property: 'Completed At', direction: 'descending' }],
      };
  }
}
