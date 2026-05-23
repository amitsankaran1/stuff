import { TaskList } from '@/components/task-list';
import { ViewHeader } from '@/components/view-header';

export default function InboxPage() {
  return (
    <>
      <ViewHeader title="Inbox" />
      <TaskList view="inbox" />
    </>
  );
}
