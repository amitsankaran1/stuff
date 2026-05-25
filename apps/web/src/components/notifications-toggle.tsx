'use client';

import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import {
  getOrCreateDeviceId,
  subscriptionToRegistration,
  urlBase64ToUint8Array,
} from '@/lib/push-client';

type State = 'unknown' | 'unsupported' | 'denied' | 'off' | 'on';

export function NotificationsToggle() {
  const [state, setState] = useState<State>('unknown');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setState('denied');
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      setState('off');
      return;
    }
    const sub = await reg.pushManager.getSubscription();
    setState(sub ? 'on' : 'off');
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function enable() {
    setError(null);
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register('/sw.js'));
      await navigator.serviceWorker.ready;

      const keyRes = await fetch('/api/push/vapid-public', { credentials: 'include' });
      if (!keyRes.ok) throw new Error(`vapid-public: ${keyRes.status}`);
      const { key } = (await keyRes.json()) as { key: string };

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const deviceId = getOrCreateDeviceId();
      const payload = subscriptionToRegistration(sub, deviceId);
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`subscribe: ${res.status}`);
      setState('on');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable notifications');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
      const deviceId = getOrCreateDeviceId();
      if (deviceId) {
        await fetch(`/api/push/subscribe/${encodeURIComponent(deviceId)}`, {
          method: 'DELETE',
          credentials: 'include',
        });
      }
      setState('off');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable notifications');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setTestResult(null);
    setBusy(true);
    try {
      const res = await fetch('/api/push/test', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`test: ${res.status}`);
      const data = (await res.json()) as {
        delivered: number;
        pruned: number;
        failed: number;
      };
      setTestResult(
        `Sent — delivered ${data.delivered}, pruned ${data.pruned}, failed ${data.failed}`,
      );
    } catch (err) {
      setTestResult(err instanceof Error ? err.message : 'Test failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-[var(--stuff-border)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium">Notifications</h2>
          <p className="mt-1 text-sm text-[var(--stuff-muted)]">{describe(state)}</p>
        </div>
        <Toggle state={state} busy={busy} onEnable={enable} onDisable={disable} />
      </div>

      {state === 'on' ? (
        <button
          type="button"
          onClick={sendTest}
          disabled={busy}
          className="self-start rounded-full border border-[var(--stuff-border)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          Send test
        </button>
      ) : null}
      {testResult ? (
        <p className="text-xs text-[var(--stuff-muted)]">{testResult}</p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Toggle({
  state,
  busy,
  onEnable,
  onDisable,
}: {
  state: State;
  busy: boolean;
  onEnable: () => void;
  onDisable: () => void;
}) {
  if (state === 'unsupported' || state === 'denied') {
    return (
      <span className="rounded-full border border-[var(--stuff-border)] px-3 py-1.5 text-xs text-[var(--stuff-muted)]">
        {state === 'unsupported' ? 'Unsupported' : 'Blocked'}
      </span>
    );
  }
  const on = state === 'on';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={on ? onDisable : onEnable}
      disabled={busy || state === 'unknown'}
      className={clsx(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50',
        on ? 'bg-[var(--stuff-fg)]' : 'bg-[var(--stuff-border)]',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 size-6 rounded-full bg-[var(--stuff-bg)] transition-transform',
          on ? 'translate-x-5' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function describe(state: State): string {
  switch (state) {
    case 'unknown':
      return 'Checking…';
    case 'unsupported':
      return 'This browser doesn’t support web push.';
    case 'denied':
      return 'Permission denied. Re-enable in browser settings.';
    case 'off':
      return 'Off. Turn on to receive reminders for tasks scheduled with a When time.';
    case 'on':
      return 'On. This device will receive reminders and the morning digest.';
  }
}
