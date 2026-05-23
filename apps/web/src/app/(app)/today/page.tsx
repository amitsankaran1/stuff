import { TaskList } from '@/components/task-list';
import { ViewHeader } from '@/components/view-header';

export default function TodayPage() {
  return (
    <>
      <ViewHeader title="Today" />
      <TaskList view="today" />
    </>
  );
}
