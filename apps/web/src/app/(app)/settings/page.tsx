import { NotificationsToggle } from '@/components/notifications-toggle';
import { ViewHeader } from '@/components/view-header';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <>
      <ViewHeader title="Settings" />
      <main className="flex flex-col gap-4 px-4 py-5">
        <NotificationsToggle />
      </main>
    </>
  );
}
