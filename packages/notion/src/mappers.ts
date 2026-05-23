import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints.js';
import type { Area, Project, Task, TaskSource, TaskStatus } from '@stuff/shared';

type Props = PageObjectResponse['properties'];

const richText = (p: Props[string] | undefined): string => {
  if (!p || p.type !== 'rich_text') return '';
  return p.rich_text.map((r) => r.plain_text).join('');
};

const title = (p: Props[string] | undefined): string => {
  if (!p || p.type !== 'title') return '';
  return p.title.map((r) => r.plain_text).join('');
};

const selectName = <T extends string>(p: Props[string] | undefined): T | null => {
  if (!p || p.type !== 'select' || !p.select) return null;
  return p.select.name as T;
};

const multiSelectNames = (p: Props[string] | undefined): string[] => {
  if (!p || p.type !== 'multi_select') return [];
  return p.multi_select.map((o) => o.name);
};

const dateStart = (p: Props[string] | undefined): string | null => {
  if (!p || p.type !== 'date' || !p.date) return null;
  return p.date.start;
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
