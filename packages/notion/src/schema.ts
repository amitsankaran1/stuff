import type { CreateDatabaseParameters } from '@notionhq/client/build/src/api-endpoints.js';

type DbProps = CreateDatabaseParameters['properties'];

export const STATUS_OPTIONS = [
  { name: 'Inbox', color: 'gray' as const },
  { name: 'Today', color: 'blue' as const },
  { name: 'Anytime', color: 'default' as const },
  { name: 'Someday', color: 'purple' as const },
  { name: 'Scheduled', color: 'yellow' as const },
  { name: 'Done', color: 'green' as const },
  { name: 'Cancelled', color: 'red' as const },
];

export const SOURCE_OPTIONS = [
  { name: 'User', color: 'default' as const },
  { name: 'Agent', color: 'pink' as const },
  { name: 'Imported', color: 'gray' as const },
];

export const PROJECT_STATUS_OPTIONS = [
  { name: 'Active', color: 'blue' as const },
  { name: 'Paused', color: 'yellow' as const },
  { name: 'Done', color: 'green' as const },
];

export const areasProperties: DbProps = {
  Name: { title: {} },
  Notes: { rich_text: {} },
};

export const projectsProperties = (areasDbId: string): DbProps => ({
  Name: { title: {} },
  Status: { select: { options: PROJECT_STATUS_OPTIONS } },
  Area: { relation: { database_id: areasDbId, single_property: {} } },
  Deadline: { date: {} },
  Notes: { rich_text: {} },
});

export const devicesProperties: DbProps = {
  // Title is the human-readable device label (user agent fragment, etc.). The
  // canonical identifier is the Device ID property below — we keep it in its
  // own field so we can filter and dedupe by it.
  Name: { title: {} },
  'Device ID': { rich_text: {} },
  Endpoint: { url: {} },
  'Key P256dh': { rich_text: {} },
  'Key Auth': { rich_text: {} },
  'User Agent': { rich_text: {} },
  'Last Seen At': { date: {} },
};

export const tasksProperties = (areasDbId: string, projectsDbId: string): DbProps => ({
  Name: { title: {} },
  Status: { select: { options: STATUS_OPTIONS } },
  When: { date: {} },
  Deadline: { date: {} },
  Project: { relation: { database_id: projectsDbId, single_property: {} } },
  Area: { relation: { database_id: areasDbId, single_property: {} } },
  Heading: { rich_text: {} },
  Tags: { multi_select: { options: [] } },
  Recurrence: { rich_text: {} },
  'Completed At': { date: {} },
  Source: { select: { options: SOURCE_OPTIONS } },
  'Agent Touched At': { date: {} },
  'Agent Notes': { rich_text: {} },
  'Proposed Status': { select: { options: STATUS_OPTIONS } },
  'Last Reminded At': { date: {} },
  'External ID': { rich_text: {} },
});

export const DB_TITLES = {
  areas: 'Stuff Areas',
  projects: 'Stuff Projects',
  tasks: 'Stuff Tasks',
  devices: 'Stuff Devices',
} as const;
