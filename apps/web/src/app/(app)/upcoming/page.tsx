import { TaskList } from '@/components/task-list';
import { ViewHeader } from '@/components/view-header';

export default function UpcomingPage() {
  return (
    <>
      <ViewHeader title="Upcoming" />
      <TaskList view="upcoming" />
    </>
  );
}
