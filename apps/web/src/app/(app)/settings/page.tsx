import { NotificationsToggle } from '@/components/notifications-toggle';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <main className="flex flex-col gap-4 px-4 py-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </header>
      <NotificationsToggle />
    </main>
  );
}
