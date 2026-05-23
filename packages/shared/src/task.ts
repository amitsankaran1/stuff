import { z } from 'zod';

export const TaskStatus = z.enum([
  'Inbox',
  'Today',
  'Anytime',
  'Someday',
  'Scheduled',
  'Done',
  'Cancelled',
]);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskSource = z.enum(['User', 'Agent', 'Imported']);
export type TaskSource = z.infer<typeof TaskSource>;

export const ProjectStatus = z.enum(['Active', 'Paused', 'Done']);
export type ProjectStatus = z.infer<typeof ProjectStatus>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const isoDateTime = z.string().datetime({ offset: true });

export const ChecklistItem = z.object({
  id: z.string(),
  text: z.string(),
  checked: z.boolean().default(false),
});
export type ChecklistItem = z.infer<typeof ChecklistItem>;

export const Task = z.object({
  id: z.string(),
  name: z.string().min(1),
  status: TaskStatus,
  when: isoDateTime.nullable().default(null),
  deadline: isoDate.nullable().default(null),
  projectId: z.string().nullable().default(null),
  areaId: z.string().nullable().default(null),
  heading: z.string().nullable().default(null),
  tags: z.array(z.string()).default([]),
  recurrence: z.string().nullable().default(null),
  notes: z.string().default(''),
  checklist: z.array(ChecklistItem).default([]),
  completedAt: isoDateTime.nullable().default(null),
  source: TaskSource.default('User'),
  agentTouchedAt: isoDateTime.nullable().default(null),
  agentNotes: z.string().nullable().default(null),
  proposedStatus: TaskStatus.nullable().default(null),
  lastRemindedAt: isoDateTime.nullable().default(null),
  externalId: z.string().nullable().default(null),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Task = z.infer<typeof Task>;

export const TaskCreate = Task.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
  lastRemindedAt: true,
})
  .partial()
  .required({ name: true });
export type TaskCreate = z.infer<typeof TaskCreate>;

export const TaskUpdate = Task.partial().required({ id: true });
export type TaskUpdate = z.infer<typeof TaskUpdate>;

export const Project = z.object({
  id: z.string(),
  name: z.string().min(1),
  status: ProjectStatus.default('Active'),
  areaId: z.string().nullable().default(null),
  deadline: isoDate.nullable().default(null),
  notes: z.string().default(''),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Project = z.infer<typeof Project>;

export const Area = z.object({
  id: z.string(),
  name: z.string().min(1),
  notes: z.string().default(''),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type Area = z.infer<typeof Area>;
