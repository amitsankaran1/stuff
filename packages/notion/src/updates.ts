import type {
  CreatePageParameters,
  UpdatePageParameters,
} from '@notionhq/client/build/src/api-endpoints.js';
import type { TaskCreate, TaskUpdate } from '@stuff/shared';

type Props = NonNullable<UpdatePageParameters['properties']>;

const titleProp = (text: string): Props[string] => ({
  title: [{ type: 'text', text: { content: text } }],
});

const richTextProp = (text: string | null): Props[string] =>
  text == null || text === ''
    ? { rich_text: [] }
    : { rich_text: [{ type: 'text', text: { content: text } }] };

const selectProp = (name: string | null): Props[string] =>
  name == null ? { select: null } : { select: { name } };

const dateProp = (iso: string | null): Props[string] =>
  iso == null ? { date: null } : { date: { start: iso } };

const relationProp = (id: string | null): Props[string] =>
  id == null ? { relation: [] } : { relation: [{ id }] };

const multiSelectProp = (names: string[]): Props[string] => ({
  multi_select: names.map((name) => ({ name })),
});

/**
 * Build a partial Notion properties payload from a partial Task. Only includes
 * the fields actually present on the input — callers can pass any subset.
 */
export function buildTaskUpdateProperties(input: Partial<TaskUpdate>): Props {
  const props: Props = {};
  if (input.name !== undefined) props['Name'] = titleProp(input.name);
  if (input.status !== undefined) props['Status'] = selectProp(input.status);
  if (input.when !== undefined) props['When'] = dateProp(input.when);
  if (input.deadline !== undefined) props['Deadline'] = dateProp(input.deadline);
  if (input.projectId !== undefined) props['Project'] = relationProp(input.projectId);
  if (input.areaId !== undefined) props['Area'] = relationProp(input.areaId);
  if (input.heading !== undefined) props['Heading'] = richTextProp(input.heading);
  if (input.tags !== undefined) props['Tags'] = multiSelectProp(input.tags);
  if (input.recurrence !== undefined) props['Recurrence'] = richTextProp(input.recurrence);
  if (input.completedAt !== undefined) props['Completed At'] = dateProp(input.completedAt);
  if (input.source !== undefined) props['Source'] = selectProp(input.source);
  if (input.agentTouchedAt !== undefined) props['Agent Touched At'] = dateProp(input.agentTouchedAt);
  if (input.agentNotes !== undefined) props['Agent Notes'] = richTextProp(input.agentNotes);
  if (input.proposedStatus !== undefined) props['Proposed Status'] = selectProp(input.proposedStatus);
  if (input.lastRemindedAt !== undefined) props['Last Reminded At'] = dateProp(input.lastRemindedAt);
  if (input.externalId !== undefined) props['External ID'] = richTextProp(input.externalId);
  return props;
}

/**
 * Build the full Notion create payload. `name` is required; everything else is optional
 * and defaults are applied (Status=Inbox, Source=User).
 */
export function buildTaskCreatePayload(
  databaseId: string,
  input: TaskCreate,
): CreatePageParameters {
  const props = buildTaskUpdateProperties({
    name: input.name,
    status: input.status ?? 'Inbox',
    source: input.source ?? 'User',
    when: input.when ?? null,
    deadline: input.deadline ?? null,
    projectId: input.projectId ?? null,
    areaId: input.areaId ?? null,
    heading: input.heading ?? null,
    tags: input.tags ?? [],
    recurrence: input.recurrence ?? null,
    agentTouchedAt: input.agentTouchedAt ?? null,
    agentNotes: input.agentNotes ?? null,
    proposedStatus: input.proposedStatus ?? null,
    externalId: input.externalId ?? null,
  });
  return {
    parent: { database_id: databaseId },
    properties: props as CreatePageParameters['properties'],
  };
}
