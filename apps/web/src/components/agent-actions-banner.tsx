'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  actOnAgentProposal,
  fetchPendingAgentActions,
  pendingAgentActionsQueryKey,
  tasksQueryKey,
} from '@/lib/api';
import { VIEW_KEYS } from '@/lib/views';

export function AgentActionsBanner() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: pendingAgentActionsQueryKey(),
    queryFn: fetchPendingAgentActions,
    refetchOnWindowFocus: true,
  });

  const act = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'confirm' | 'reject' }) =>
      actOnAgentProposal(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pendingAgentActionsQueryKey() });
      for (const v of VIEW_KEYS) qc.invalidateQueries({ queryKey: tasksQueryKey(v) });
    },
  });

  if (!data || data.count === 0) return null;

  return (
    <section
      aria-label="Pending agent actions"
      className="mx-4 mt-3 flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Pending agent {data.count === 1 ? 'action' : 'actions'} ({data.count})
        </h2>
      </header>
      <ul className="flex flex-col gap-2">
        {data.tasks.map((t) => (
          <li
            key={t.id}
            className="flex flex-col gap-2 rounded-xl bg-[var(--stuff-bg)]/60 p-3 text-sm"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{t.name}</span>
              <span className="text-xs text-[var(--stuff-muted)]">
                proposes <strong>{t.proposedStatus}</strong>
                {t.agentNotes ? ` — ${t.agentNotes}` : ''}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={act.isPending}
                onClick={() => act.mutate({ id: t.id, action: 'confirm' })}
                className="rounded-full bg-[var(--stuff-fg)] px-3 py-1.5 text-xs font-medium text-[var(--stuff-bg)] disabled:opacity-50"
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={act.isPending}
                onClick={() => act.mutate({ id: t.id, action: 'reject' })}
                className="rounded-full border border-[var(--stuff-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
