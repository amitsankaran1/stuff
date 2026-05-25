import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import type { Area, Device, Project, Task, TaskSource, TaskStatus } from '@stuff/shared';

type Props = PageObjectResponse['properties'];

const richText = (p: Props[string] | undefined): string => {
  if (!p || p.type !== 'rich_text') return '';
  return p.rich_text.map((r) => r.plain_text).join('');
};

const title = (p: Props[string] | undefined): string => {
  if (!p || p.type !== 'title') return '';
  return p.title.map((r) => r.plain_text).join('');
};

// Reads both `select` and `status` property values. Notion distinguishes the
// two types, and a "Status" column may have been converted from select to
// status (Notion auto-suggests this for columns named "Status").
const selectName = <T extends string>(p: Props[string] | undefined): T | null => {
  if (!p) return null;
  if (p.type === 'select') return (p.select?.name ?? null) as T | null;
  if (p.type === 'status') return (p.status?.name ?? null) as T | null;
  return null;
};

const multiSelectNames = (p: Props[string] | undefined): string[] => {
  if (!p || p.type !== 'multi_select') return [];
  return p.multi_select.map((o) => o.name);
};

const dateStart = (p: Props[string] | undefined): string | null => {
  if (!p || p.type !== 'date' || !p.date) return null;
  return p.date.start;
};

const url = (p: Props[string] | undefined): string | null => {
  if (!p || p.type !== 'url') return null;
  return p.url ?? null;
};

const relationFirst = (p: Props[string] | undefined): string | null => {
  if (!p || p.type !== 'relation' || p.relation.length === 0) return null;
  return p.relation[0]?.id ?? null;
};

export function mapTask(page: PageObjectResponse): Task {
  const p = page.properties;
  const whenRaw = dateStart(p['When']);
  const completedRaw = dateStart(p['Completed At']);
  const agentTouchedRaw = dateStart(p['Agent Touched At']);
  const lastRemindedRaw = dateStart(p['Last Reminded At']);

  return {
    id: page.id,
    name: title(p['Name']),
    status: (selectName<TaskStatus>(p['Status']) ?? 'Inbox') as TaskStatus,
    when: whenRaw ? new Date(whenRaw).toISOString() : null,
    deadline: dateStart(p['Deadline']),
    projectId: relationFirst(p['Project']),
    areaId: relationFirst(p['Area']),
    heading: richText(p['Heading']) || null,
    tags: multiSelectNames(p['Tags']),
    recurrence: richText(p['Recurrence']) || null,
    notes: '',
    checklist: [],
    completedAt: completedRaw ? new Date(completedRaw).toISOString() : null,
    source: (selectName<TaskSource>(p['Source']) ?? 'User') as TaskSource,
    agentTouchedAt: agentTouchedRaw ? new Date(agentTouchedRaw).toISOString() : null,
    agentNotes: richText(p['Agent Notes']) || null,
    proposedStatus: selectName<TaskStatus>(p['Proposed Status']),
    lastRemindedAt: lastRemindedRaw ? new Date(lastRemindedRaw).toISOString() : null,
    externalId: richText(p['External ID']) || null,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

export function mapProject(page: PageObjectResponse): Project {
  const p = page.properties;
  return {
    id: page.id,
    name: title(p['Name']),
    status: (selectName<Project['status']>(p['Status']) ?? 'Active') as Project['status'],
    areaId: relationFirst(p['Area']),
    deadline: dateStart(p['Deadline']),
    notes: richText(p['Notes']),
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

export function mapDevice(page: PageObjectResponse): Device {
  const p = page.properties;
  const lastSeenRaw = dateStart(p['Last Seen At']);
  return {
    id: page.id,
    deviceId: richText(p['Device ID']),
    label: title(p['Name']),
    endpoint: url(p['Endpoint']) ?? '',
    keys: {
      p256dh: richText(p['Key P256dh']),
      auth: richText(p['Key Auth']),
    },
    userAgent: richText(p['User Agent']) || null,
    lastSeenAt: lastSeenRaw ? new Date(lastSeenRaw).toISOString() : null,
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}

export function mapArea(page: PageObjectResponse): Area {
  const p = page.properties;
  return {
    id: page.id,
    name: title(p['Name']),
    notes: richText(p['Notes']),
    createdAt: page.created_time,
    updatedAt: page.last_edited_time,
  };
}
