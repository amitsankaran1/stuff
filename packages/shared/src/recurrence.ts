import { RRule, rrulestr } from 'rrule';

export interface RecurrenceNext {
  rrule: string;
  iteration: number;
  occurrence: Date;
}

export function parseRRule(value: string): RRule {
  return rrulestr(value) as RRule;
}

export function nextOccurrence(rrule: string, after: Date = new Date()): Date | null {
  return parseRRule(rrule).after(after, true) ?? null;
}

export function iterationKey(parentId: string, occurrence: Date): string {
  return `recurrence:${parentId}:${occurrence.toISOString().slice(0, 10)}`;
}
